"""
Shared service-request workflow: transitions, invoices, timeline, and action handlers.

Used by Flask web routes and /api/v1 JSON routes to avoid duplicated business logic.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from sqlalchemy import func, inspect
from sqlalchemy.exc import SQLAlchemyError

from models import (
    Invoice,
    Payment,
    RequestTimeline,
    ServiceRequest,
    Specialization,
    TechnicianOffer,
    TechnicianRating,
    User,
    db,
)
from geo_utils import MAP_PIN_REQUIRED_MESSAGE, parse_optional_coordinates
from timeline_messages import encode_timeline, money_str

load_dotenv()

log = logging.getLogger(__name__)


def _read_default_tax_rate() -> Decimal:
    raw = os.getenv("DEFAULT_TAX_RATE", "5.00")
    try:
        rate = Decimal(str(raw))
    except Exception:
        rate = Decimal("5.00")
    if rate < 0:
        rate = Decimal("0.00")
    if rate > 100:
        rate = Decimal("100.00")
    return rate.quantize(Decimal("0.01"))


DEFAULT_TAX_RATE = _read_default_tax_rate()

REQUEST_ATTACHMENT_DIR = os.path.join("static", "uploads", "request_attachments")
ALLOWED_REQUEST_IMAGE_EXT = frozenset({"png", "jpg", "jpeg", "webp", "gif"})
ALLOWED_REQUEST_VIDEO_EXT = frozenset({"mp4", "mov", "webm", "m4v"})
MAX_REQUEST_ATTACHMENT_BYTES = 25 * 1024 * 1024


def classify_request_media_file(filename: str) -> tuple[str, str] | None:
    """Return (attachment_kind, extension_lower) or None if unsupported."""
    if not filename or "." not in filename:
        return None
    ext = filename.rsplit(".", 1)[1].lower()
    if ext in ALLOWED_REQUEST_IMAGE_EXT:
        return "image", ext
    if ext in ALLOWED_REQUEST_VIDEO_EXT:
        return "video", ext
    return None


def _request_attachment_file_size(attachment_file: Any) -> int | None:
    try:
        attachment_file.stream.seek(0, os.SEEK_END)
        n = int(attachment_file.stream.tell())
        attachment_file.stream.seek(0)
        return n
    except OSError:
        return None


def compute_invoice_totals(
    subtotal: Decimal, tax_rate: Decimal = DEFAULT_TAX_RATE
) -> tuple[Decimal, Decimal]:
    normalized_subtotal = Decimal(str(subtotal)).quantize(Decimal("0.01"))
    normalized_tax_rate = Decimal(str(tax_rate)).quantize(Decimal("0.01"))
    tax_amount = (normalized_subtotal * normalized_tax_rate) / Decimal("100")
    total_amount = normalized_subtotal + tax_amount
    return tax_amount.quantize(Decimal("0.01")), total_amount.quantize(Decimal("0.01"))


def generate_invoice_number(issue_time: Optional[datetime] = None) -> str:
    issued_at = issue_time or datetime.utcnow()
    year = issued_at.year
    annual_count = Invoice.query.filter(func.year(Invoice.issued_at) == year).count()
    sequence = annual_count + 1
    return f"INV-{year}-{sequence:04d}"


ALLOWED_REQUEST_TRANSITIONS = {
    "pending": {"in_progress"},
    "in_progress": {"completed"},
    "completed": set(),
    "cancelled": set(),
    "assigned": {"in_progress", "cancelled"},
}


def can_transition_request(service_req: ServiceRequest, next_status: str) -> bool:
    return next_status in ALLOWED_REQUEST_TRANSITIONS.get(service_req.status, set())


def timeline_table_exists() -> bool:
    try:
        return inspect(db.engine).has_table("request_timeline")
    except Exception:
        return False


def add_timeline_entry(
    service_req: ServiceRequest, status: str, note: str, actor_id: Optional[int]
) -> None:
    if not timeline_table_exists():
        return
    entry = RequestTimeline(
        request_id=service_req.request_id,
        status=status,
        note=note,
        actor_id=actor_id,
    )
    db.session.add(entry)


def build_track_status_payload(service_req: ServiceRequest) -> dict:
    rid = service_req.request_id
    offers_count = TechnicianOffer.query.filter_by(request_id=rid).count()
    raw_sum = (
        db.session.query(func.coalesce(func.sum(TechnicianOffer.total_amount), 0))
        .filter(TechnicianOffer.request_id == rid)
        .scalar()
        or 0
    )
    amt = Decimal(str(raw_sum)).quantize(Decimal("0.01"))
    return {
        "status": service_req.status,
        "payment_status": service_req.payment_status,
        "offers_count": int(offers_count),
        "offers_amount_sum": str(amt),
    }


def coerce_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def sanitize_input(text: str) -> str:
    if not text:
        return ""
    return text.strip()


# --- Action handlers: return (body: dict, http_status: int) ---


def customer_create_request(
    actor: User, data: dict[str, Any], attachment_file: Any | None = None
) -> tuple[dict, int]:
    if actor.role != "customer":
        return {"success": False, "message": "فقط العملاء يمكنهم إنشاء طلبات"}, 403

    raw_st = data.get("service_type")
    if raw_st is None or (isinstance(raw_st, str) and not str(raw_st).strip()):
        return {"success": False, "message": "يرجى اختيار نوع الخدمة"}, 400
    try:
        service_type = int(raw_st)
    except (TypeError, ValueError):
        return {"success": False, "message": "يرجى اختيار نوع الخدمة"}, 400

    description = sanitize_input(str(data.get("description", "") or ""))
    city = sanitize_input(str(data.get("city", "") or ""))
    district = sanitize_input(str(data.get("district", "") or ""))
    address = sanitize_input(str(data.get("address", "") or ""))
    preferred_date = data.get("preferred_date")
    preferred_time = data.get("preferred_time")
    notes = sanitize_input(str(data.get("notes", "") or ""))

    if not description or len(description) < 20:
        return {"success": False, "message": "يرجى كتابة وصف تفصيلي للمشكلة (20 حرف على الأقل)"}, 400
    if not city or not district or not address:
        return {"success": False, "message": "يرجى إدخال جميع تفاصيل العنوان"}, 400
    if not preferred_date:
        return {"success": False, "message": "يرجى اختيار التاريخ المفضل"}, 400
    if not preferred_time:
        return {"success": False, "message": "يرجى اختيار الوقت المفضل"}, 400

    latitude, longitude, coord_err = parse_optional_coordinates(data)
    if coord_err:
        return {"success": False, "message": coord_err}, 400
    if latitude is None or longitude is None:
        return {"success": False, "message": MAP_PIN_REQUIRED_MESSAGE}, 400

    spec = Specialization.query.get(service_type)
    if not spec:
        return {"success": False, "message": "نوع الخدمة المختار غير موجود"}, 400

    try:
        if isinstance(preferred_date, str):
            selected_date = datetime.strptime(preferred_date, "%Y-%m-%d").date()
        else:
            selected_date = preferred_date
        if selected_date < datetime.utcnow().date():
            return {"success": False, "message": "لا يمكن اختيار تاريخ في الماضي"}, 400
    except (TypeError, ValueError):
        return {"success": False, "message": "تاريخ غير صحيح"}, 400

    attachment_path: str | None = None
    attachment_kind: str | None = None
    if attachment_file is not None:
        fname = str(getattr(attachment_file, "filename", "") or "").strip()
        if fname:
            classified = classify_request_media_file(fname)
            if classified is None:
                return {
                    "success": False,
                    "message": "صيغة المرفق غير مدعومة (صور: PNG, JPG, JPEG, WEBP أو فيديو: MP4, MOV, WEBM)",
                }, 400
            attachment_kind, ext = classified
            sz = _request_attachment_file_size(attachment_file)
            if sz is None:
                return {"success": False, "message": "تعذر قراءة الملف"}, 400
            if sz > MAX_REQUEST_ATTACHMENT_BYTES:
                return {"success": False, "message": "حجم الملف كبير جداً (الحد الأقصى 25 ميجابايت)"}, 400
            os.makedirs(REQUEST_ATTACHMENT_DIR, exist_ok=True)
            stored_name = secure_filename(
                f"req_{actor.user_id}_{uuid.uuid4().hex[:12]}.{ext}"
            )
            storage_path = os.path.join(REQUEST_ATTACHMENT_DIR, stored_name)
            try:
                attachment_file.save(storage_path)
            except OSError:
                log.exception("customer_create_request: attachment save failed")
                return {"success": False, "message": "تعذر حفظ الملف"}, 500
            attachment_path = f"uploads/request_attachments/{stored_name}"

    try:
        service_req = ServiceRequest(
            customer_id=actor.user_id,
            service_type=service_type,
            description=description,
            city=city,
            district=district,
            address=address,
            latitude=latitude,
            longitude=longitude,
            location_captured_at=datetime.utcnow() if latitude is not None else None,
            preferred_date=selected_date,
            preferred_time=preferred_time,
            notes=notes,
            attachment_path=attachment_path,
            attachment_kind=attachment_kind,
        )
        db.session.add(service_req)
        db.session.flush()
        add_timeline_entry(
            service_req,
            "pending",
            encode_timeline("created_by_customer"),
            actor.user_id,
        )
        db.session.commit()
        return {
            "success": True,
            "message": "تم إرسال الطلب بنجاح",
            "request_id": service_req.request_id,
        }, 201
    except SQLAlchemyError as e:
        log.exception("customer_create_request: db error")
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ في قاعدة البيانات"}, 500
    except Exception as e:
        log.exception("customer_create_request: unexpected")
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ غير متوقع"}, 500


def technician_submit_offer(
    actor: User, request_id: int, data: dict[str, Any]
) -> tuple[dict, int]:
    try:
        if actor.role != "technician":
            log.info(
                "technician_submit_offer: not technician uid=%s", getattr(actor, "user_id", None)
            )
            return {"success": False, "message": "هذه العملية متاحة للفنيين فقط"}, 403
        if actor.specialization_id is None:
            log.info(
                "technician_submit_offer: no specialization uid=%s", actor.user_id
            )
            return {
                "success": False,
                "message": "لم يُحفظ تخصصك. افتح الملف الشخصي، اختر التخصص، احفظ، ثم أعد إرسال العرض.",
            }, 400

        service_req = ServiceRequest.query.get(request_id)
        if service_req is None:
            return {"success": False, "message": "الطلب غير موجود"}, 404

        if service_req.status != "pending":
            log.info(
                "technician_submit_offer: not pending rid=%s status=%s",
                request_id,
                service_req.status,
            )
            return {"success": False, "message": "لا يمكن تقديم عرض على طلب غير مفتوح"}, 400
        if service_req.customer_id == actor.user_id:
            return {"success": False, "message": "لا يمكنك تقديم عرض على طلبك الخاص"}, 400
        if service_req.technician_id and service_req.technician_id != actor.user_id:
            return {"success": False, "message": "تم إسناد الطلب لفني آخر"}, 409

        try:
            req_spec = int(service_req.service_type)
            tech_spec = int(actor.specialization_id)
        except (TypeError, ValueError):
            log.warning(
                "technician_submit_offer: bad spec rid=%s st=%r ts=%r",
                request_id,
                service_req.service_type,
                actor.specialization_id,
            )
            return {
                "success": False,
                "message": "بيانات التخصص غير صالحة. راجع الملف الشخصي أو نوع الطلب.",
            }, 400
        if req_spec != tech_spec:
            log.info(
                "technician_submit_offer: spec mismatch rid=%s rs=%s ts=%s uid=%s",
                request_id,
                req_spec,
                tech_spec,
                actor.user_id,
            )
            return {
                "success": False,
                "message": f"تخصص الطلب ({req_spec}) لا يطابق تخصصك ({tech_spec}). اختر طلباً بنفس التخصص أو حدّث تخصصك من الملف الشخصي.",
            }, 400

        amount = data.get("amount")
        note = sanitize_input(str(data.get("note", "") or ""))
        legacy_message = sanitize_input(str(data.get("message", "") or ""))
        try:
            amount_val = Decimal(str(amount)) if amount is not None else None
        except Exception:
            amount_val = None
        if amount_val is None or amount_val <= 0:
            return {"success": False, "message": "المبلغ المدخل غير صالح"}, 400
        final_note = note or legacy_message

        offer = TechnicianOffer.query.filter_by(
            request_id=request_id, technician_id=actor.user_id
        ).first()
        if offer:
            if offer.status == "accepted":
                return {"success": False, "message": "تم قبول عرضك بالفعل لهذا الطلب"}, 400
            offer.amount = amount_val
            offer.note = final_note or None
            offer.tax_rate = DEFAULT_TAX_RATE
            offer.tax_amount, offer.total_amount = compute_invoice_totals(
                amount_val, DEFAULT_TAX_RATE
            )
            offer.status = "pending"
        else:
            tax_amount, total_amount = compute_invoice_totals(amount_val, DEFAULT_TAX_RATE)
            offer = TechnicianOffer(
                request_id=request_id,
                technician_id=actor.user_id,
                amount=amount_val,
                tax_rate=DEFAULT_TAX_RATE,
                tax_amount=tax_amount,
                total_amount=total_amount,
                note=final_note or None,
                status="pending",
            )
            db.session.add(offer)
        add_timeline_entry(
            service_req,
            service_req.status,
            encode_timeline("offer_sent", a=actor.user_id),
            actor.user_id,
        )
        db.session.commit()
        log.info(
            "technician_submit_offer: OK rid=%s oid=%s tech=%s",
            request_id,
            offer.offer_id,
            actor.user_id,
        )
        return {
            "success": True,
            "message": "تم إرسال العرض بنجاح",
            "request_id": request_id,
            "offer_id": offer.offer_id,
            "offer_status": offer.status,
        }, 200
    except SQLAlchemyError:
        log.exception("technician_submit_offer: db")
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ في قاعدة البيانات"}, 500
    except Exception as e:
        log.exception("technician_submit_offer failed rid=%s", request_id)
        db.session.rollback()
        try:
            from flask import current_app

            detail = (
                f"حدث خطأ غير متوقع: {e!s}" if current_app.debug else "حدث خطأ غير متوقع"
            )
        except Exception:
            detail = "حدث خطأ غير متوقع"
        return {"success": False, "message": detail}, 500


def customer_choose_offer(actor: User, offer_id: int) -> tuple[dict, int]:
    try:
        if actor.role != "customer":
            return {"success": False, "message": "هذه العملية متاحة للعملاء فقط"}, 403
        offer = TechnicianOffer.query.get(offer_id)
        if offer is None:
            return {"success": False, "message": "العرض غير موجود"}, 404
        service_req = ServiceRequest.query.get(offer.request_id)
        if service_req is None:
            return {"success": False, "message": "الطلب غير موجود"}, 404
        if service_req.customer_id != actor.user_id:
            return {"success": False, "message": "لا يمكنك اختيار عرض لهذا الطلب"}, 403
        if service_req.status != "pending":
            return {"success": False, "message": "لا يمكن اختيار عرض بعد تغيير حالة الطلب"}, 400
        if offer.status != "pending":
            return {"success": False, "message": "هذا العرض غير متاح للاختيار حالياً"}, 400

        other_offers = TechnicianOffer.query.filter(
            TechnicianOffer.request_id == service_req.request_id,
            TechnicianOffer.offer_id != offer.offer_id,
            TechnicianOffer.status != "withdrawn",
        ).all()
        for item in other_offers:
            item.status = "rejected"
        offer.status = "accepted"
        service_req.technician_id = offer.technician_id
        service_req.status = "assigned"
        service_req.payment_status = "pending"
        if not service_req.invoice:
            issue_time = datetime.utcnow()
            invoice = Invoice(
                request_id=service_req.request_id,
                offer_id=offer.offer_id,
                subtotal=offer.amount,
                tax_rate=offer.tax_rate,
                tax_amount=offer.tax_amount,
                total=offer.total_amount,
                invoice_number=generate_invoice_number(issue_time),
                issued_at=issue_time,
                payment_status="pending",
            )
            db.session.add(invoice)
        pending_payment = Payment(
            request_id=service_req.request_id,
            amount=offer.total_amount,
            method="credit_card",
            transaction_id=str(uuid.uuid4()),
            status="pending",
        )
        db.session.add(pending_payment)
        add_timeline_entry(
            service_req,
            "assigned",
            encode_timeline("offer_chosen", m=money_str(offer.amount)),
            actor.user_id,
        )
        db.session.commit()
        return {
            "success": True,
            "message": "تم اختيار العرض وتعيين الفني بنجاح",
            "request_id": service_req.request_id,
            "offer_id": offer.offer_id,
        }, 200
    except SQLAlchemyError:
        log.exception("customer_choose_offer: db")
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ في قاعدة البيانات"}, 500
    except Exception:
        log.exception("customer_choose_offer")
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ غير متوقع"}, 500


def get_request_for_technician(
    actor: User, request_id: int
) -> tuple[Optional[ServiceRequest], Optional[dict], Optional[int]]:
    service_req = ServiceRequest.query.get(request_id)
    if service_req is None:
        return None, {"success": False, "message": "الطلب غير موجود"}, 404
    if actor.role != "technician":
        return None, {"success": False, "message": "هذه العملية متاحة للفنيين فقط"}, 403
    if service_req.technician_id is not None and service_req.technician_id != actor.user_id:
        return None, {"success": False, "message": "لا تملك صلاحية إدارة هذا الطلب"}, 403
    return service_req, None, None


def technician_accept_request(
    actor: User, request_id: int, data: dict[str, Any]
) -> tuple[dict, int]:
    try:
        service_req, err_body, err_code = get_request_for_technician(actor, request_id)
        if err_body is not None and err_code is not None:
            return err_body, err_code

        assert service_req is not None

        if not can_transition_request(service_req, "in_progress"):
            return {
                "success": False,
                "message": f'لا يمكن قبول الطلب وهو بحالة "{service_req.status}"',
            }, 400
        if service_req.technician_id not in (None, actor.user_id):
            return {"success": False, "message": "تم إسناد هذا الطلب إلى فني آخر"}, 409

        active_requests = ServiceRequest.query.filter_by(
            technician_id=actor.user_id, status="in_progress"
        ).count()
        if active_requests >= 3:
            return {"success": False, "message": "لديك طلبات كثيرة قيد التنفيذ"}, 400

        req_spec = coerce_int(service_req.service_type)
        tech_spec = coerce_int(actor.specialization_id)
        if req_spec is None or tech_spec is None:
            return {"success": False, "message": "بيانات التخصص غير صالحة"}, 400
        if req_spec != tech_spec:
            return {"success": False, "message": "هذا الطلب لا يتناسب مع تخصصك"}, 400

        amount_val: Optional[Decimal] = None
        if service_req.status == "pending":
            amount = data.get("amount")
            try:
                amount_val = Decimal(str(amount)) if amount is not None else None
            except Exception:
                amount_val = None
            if amount_val is None or amount_val <= 0:
                return {"success": False, "message": "المبلغ المدخل غير صالح"}, 400
            existing_offer = TechnicianOffer.query.filter_by(
                request_id=service_req.request_id, technician_id=actor.user_id
            ).first()
            if existing_offer:
                existing_offer.status = "accepted"
            service_req.technician_id = actor.user_id
            pending_payment = Payment(
                request_id=request_id,
                amount=amount_val,
                method="credit_card",
                transaction_id=str(uuid.uuid4()),
                status="pending",
            )
            db.session.add(pending_payment)
        else:
            pending_payment = (
                Payment.query.filter_by(request_id=request_id, status="pending")
                .order_by(Payment.created_at.desc())
                .first()
            )
            if not pending_payment:
                return {
                    "success": False,
                    "message": "لا يوجد مبلغ متفق عليه لبدء التنفيذ",
                }, 400
            amount_val = Decimal(str(pending_payment.amount))
            service_req.technician_id = actor.user_id

        service_req.status = "in_progress"
        service_req.payment_status = "pending"
        add_timeline_entry(
            service_req,
            "in_progress",
            encode_timeline("work_started", m=money_str(amount_val)),
            actor.user_id,
        )
        db.session.commit()
        return {"success": True, "message": "تم بدء تنفيذ الطلب بنجاح", "request_id": request_id}, 200
    except SQLAlchemyError:
        log.exception("technician_accept_request: db")
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ في قاعدة البيانات"}, 500
    except Exception:
        log.exception("technician_accept_request")
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ غير متوقع"}, 500


def technician_complete_request(actor: User, request_id: int) -> tuple[dict, int]:
    try:
        service_req, err_body, err_code = get_request_for_technician(actor, request_id)
        if err_body is not None and err_code is not None:
            return err_body, err_code

        assert service_req is not None

        if not can_transition_request(service_req, "completed"):
            return {
                "success": False,
                "message": f'لا يمكن إكمال الطلب وهو بحالة "{service_req.status}"',
            }, 400
        if service_req.payment_status != "completed":
            return {
                "success": False,
                "message": "يجب على العميل دفع المبلغ قبل إكمال العمل",
            }, 400
        if service_req.technician_id != actor.user_id:
            return {"success": False, "message": "لا يمكنك إكمال طلب غير مسند لك"}, 403

        service_req.status = "completed"
        service_req.completed_at = datetime.utcnow()
        add_timeline_entry(
            service_req,
            "completed",
            encode_timeline("work_completed"),
            actor.user_id,
        )
        db.session.commit()
        return {"success": True, "message": "تم إكمال الطلب بنجاح", "request_id": request_id}, 200
    except SQLAlchemyError:
        log.exception("technician_complete_request: db")
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ في قاعدة البيانات"}, 500
    except Exception:
        log.exception("technician_complete_request")
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ غير متوقع"}, 500


def customer_pay_request(actor: User, request_id: int) -> tuple[dict, int]:
    try:
        service_req = ServiceRequest.query.get(request_id)
        if service_req is None:
            return {"success": False, "message": "الطلب غير موجود"}, 404
        if actor.role != "customer" or service_req.customer_id != actor.user_id:
            return {"success": False, "message": "غير مسموح لك بالدفع لهذا الطلب"}, 403
        if service_req.status != "in_progress":
            return {
                "success": False,
                "message": "لا يمكن الدفع قبل أن يبدأ الفني تنفيذ الطلب",
            }, 400
        if service_req.payment_status == "completed":
            return {"success": False, "message": "تم دفع هذا الطلب مسبقاً"}, 400

        payment = (
            Payment.query.filter_by(request_id=request_id, status="pending")
            .order_by(Payment.created_at.desc())
            .first()
        )
        if not payment:
            return {
                "success": False,
                "message": "لا يمكن الدفع حالياً: لم يحدد الفني المبلغ بعد",
            }, 400

        payment.status = "completed"
        payment.method = "credit_card"
        payment.transaction_id = str(uuid.uuid4())

        service_req.payment_status = "completed"
        if not service_req.invoice:
            total_incl_tax = Decimal(str(payment.amount)).quantize(Decimal("0.01"))
            divisor = Decimal("100") + DEFAULT_TAX_RATE
            subtotal = (total_incl_tax * Decimal("100") / divisor).quantize(Decimal("0.01"))
            tax_amount = (total_incl_tax - subtotal).quantize(Decimal("0.01"))
            invoice = Invoice(
                request_id=service_req.request_id,
                subtotal=subtotal,
                tax_rate=DEFAULT_TAX_RATE,
                tax_amount=tax_amount,
                total=total_incl_tax,
                invoice_number=generate_invoice_number(),
                payment_status="pending",
            )
            db.session.add(invoice)
            target_invoice = invoice
        else:
            target_invoice = service_req.invoice
        target_invoice.payment_status = "paid"
        add_timeline_entry(
            service_req,
            service_req.status,
            encode_timeline("payment_done", m=money_str(payment.amount)),
            actor.user_id,
        )
        db.session.commit()
        return {
            "success": True,
            "message": f"تمت عملية الدفع بنجاح بقيمة {payment.amount} ل.س",
            "request_id": request_id,
        }, 200
    except SQLAlchemyError:
        log.exception("customer_pay_request: db")
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ في قاعدة البيانات"}, 500
    except Exception:
        log.exception("customer_pay_request")
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ غير متوقع"}, 500


def customer_submit_rating(actor: User, request_id: int, data: dict[str, Any]) -> tuple[dict, int]:
    try:
        service_req = ServiceRequest.query.get(request_id)
        if service_req is None:
            return {"success": False, "message": "الطلب غير موجود"}, 404
        if actor.role != "customer" or service_req.customer_id != actor.user_id:
            return {"success": False, "message": "لا يمكنك تقييم هذا الطلب"}, 403
        if service_req.status != "completed" or service_req.payment_status != "completed":
            return {
                "success": False,
                "message": "يمكن التقييم بعد إكمال الطلب والدفع فقط",
            }, 400
        if not service_req.technician_id:
            return {"success": False, "message": "لا يوجد فني مرتبط بهذا الطلب"}, 400
        if TechnicianRating.query.filter_by(request_id=request_id).first():
            return {"success": False, "message": "تم تقييم هذا الطلب مسبقاً"}, 400

        score = data.get("stars") if isinstance(data, dict) else None
        if score is None and isinstance(data, dict):
            score = data.get("score")
        comment = sanitize_input(str(data.get("comment", "") or "")) if isinstance(data, dict) else ""
        try:
            score_val = int(score)
        except (TypeError, ValueError):
            return {"success": False, "message": "قيمة التقييم غير صالحة"}, 400
        if score_val < 1 or score_val > 5:
            return {"success": False, "message": "التقييم يجب أن يكون بين 1 و5"}, 400

        rating = TechnicianRating(
            request_id=request_id,
            technician_id=service_req.technician_id,
            customer_id=actor.user_id,
            stars=score_val,
            comment=comment or None,
        )
        db.session.add(rating)
        add_timeline_entry(
            service_req,
            service_req.status,
            encode_timeline("rating_added", s=int(score_val)),
            actor.user_id,
        )
        db.session.commit()
        return {
            "success": True,
            "message": "تم حفظ التقييم بنجاح",
            "request_id": request_id,
            "rating_id": rating.rating_id,
            "stars": rating.stars,
        }, 200
    except SQLAlchemyError:
        log.exception("customer_submit_rating: db")
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ في قاعدة البيانات"}, 500
    except Exception:
        log.exception("customer_submit_rating")
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ غير متوقع"}, 500
