from __future__ import annotations

from typing import Any

import os
import uuid

from flask import Blueprint, current_app, g, jsonify, request
from werkzeug.utils import secure_filename
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import check_password_hash, generate_password_hash

from api_jwt import create_access_token, require_api_jwt
from models import ServiceRequest, Specialization, TechnicianRating, User, db
from portfolio_service import (
    create_portfolio_item,
    delete_portfolio_item,
    list_portfolio_for_owner,
    patch_portfolio_item,
    reorder_portfolio_items,
)
from service_request_actions import (
    customer_choose_offer,
    customer_create_request,
    customer_pay_request,
    customer_submit_rating,
    technician_accept_request,
    technician_complete_request,
    technician_submit_offer,
)

api_v1_bp = Blueprint("api_v1", __name__, url_prefix="/api/v1")


def _action_response_with_request(actor: User, body: dict[str, Any], code: int):
    """On success, include full request detail when the actor may view it."""
    from api_service_requests import api_can_view_request, build_request_detail_payload

    out = dict(body)
    rid = body.get("request_id")
    if body.get("success") and rid is not None:
        sr = ServiceRequest.query.get(int(rid))
        if sr is not None and api_can_view_request(actor, sr):
            out["request"] = build_request_detail_payload(actor, sr)
    return jsonify(out), code


def _user_token_payload(user: User) -> dict[str, Any]:
    role = user.role
    if role is not None and not isinstance(role, str):
        role = str(role)
    spec_id = user.specialization_id
    if spec_id is not None:
        spec_id = int(spec_id)
    return {
        "user_id": int(user.user_id),
        "email": user.email or "",
        "role": role,
        "specialization_id": spec_id,
    }


def _user_me_payload(user: User) -> dict[str, Any]:
    from app import get_user_name_parts

    name_ar, name_en = get_user_name_parts(user)
    raw_path = (user.profile_image or "").strip()
    url_path = f"/static/{raw_path.lstrip('/')}" if raw_path else None
    created = user.created_at
    created_iso = created.isoformat() + "Z" if created else None

    payload: dict[str, Any] = {
        **_user_token_payload(user),
        "full_name_ar": name_ar,
        "full_name_en": name_en,
        "phone": user.phone,
        "city": user.city,
        "district": user.district,
        "bio": user.bio,
        "created_at": created_iso,
        "profile_image": user.profile_image,
        "profile_image_url_path": url_path,
    }
    spec = user.specialization
    if spec is not None:
        payload["specialization"] = {
            "spec_id": spec.spec_id,
            "name_ar": spec.name_ar,
            "name_en": spec.name_en,
        }
    else:
        payload["specialization"] = None

    if user.role == "technician":
        avg = (
            db.session.query(func.avg(TechnicianRating.stars))
            .filter(TechnicianRating.technician_id == user.user_id)
            .scalar()
        )
        cnt = TechnicianRating.query.filter_by(technician_id=user.user_id).count()
        payload["rating_summary"] = {
            "avg_stars": round(float(avg), 2) if avg is not None else None,
            "ratings_count": int(cnt),
        }
    else:
        payload["rating_summary"] = None

    return payload


@api_v1_bp.get("/specializations")
def api_specializations_list():
    """Service types (read-only). Public so signup can call before JWT; same data when authenticated."""
    specs = Specialization.query.order_by(Specialization.spec_id).all()
    items = [
        {"spec_id": s.spec_id, "name_ar": s.name_ar, "name_en": s.name_en} for s in specs
    ]
    return jsonify(specializations=items)


@api_v1_bp.get("/me")
@require_api_jwt
def api_me():
    return jsonify(user=_user_me_payload(g.api_user))


@api_v1_bp.route("/me", methods=["PATCH"])
@require_api_jwt
def api_patch_me():
    """Update profile fields (same rules as web `update_profile`, JSON body)."""
    from app import sanitize_input, validate_password, validate_phone

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(success=False, message="يجب إرسال JSON صالح"), 400

    user = g.api_user

    full_name_ar = sanitize_input(str(data.get("full_name_ar", "") or ""))
    full_name_en = sanitize_input(str(data.get("full_name_en", "") or ""))
    phone = sanitize_input(str(data.get("phone", "") or ""))
    city = sanitize_input(str(data.get("city", "") or ""))
    district = sanitize_input(str(data.get("district", "") or ""))
    bio_raw = str(data.get("bio", "") or "")
    bio = sanitize_input(bio_raw)

    if not full_name_ar or not full_name_en:
        return jsonify(success=False, message="يرجى إدخال الاسم الكامل باللغتين"), 400
    if not validate_phone(phone):
        return jsonify(success=False, message="يرجى إدخال رقم هاتف صحيح"), 400
    if len(city) > 100 or len(district) > 100:
        return jsonify(success=False, message="المدينة أو المنطقة طويلة جداً"), 400
    if len(bio) > 500:
        return jsonify(success=False, message="النبذة طويلة جداً (الحد 500 حرف)"), 400

    specialization_id: int | None = None
    if user.role == "technician":
        spec_raw = data.get("specialization_id")
        if spec_raw is None or spec_raw == "":
            return jsonify(success=False, message="يرجى اختيار التخصص"), 400
        try:
            specialization_id = int(spec_raw)
        except (TypeError, ValueError):
            return jsonify(success=False, message="معرف التخصص غير صالح"), 400
        spec = Specialization.query.get(specialization_id)
        if not spec:
            return jsonify(success=False, message="التخصص المختار غير موجود"), 400

    current_pw = data.get("current_password")
    new_pw = data.get("new_password")
    confirm_pw = data.get("confirm_password")
    if not isinstance(current_pw, str):
        current_pw = ""
    if not isinstance(new_pw, str):
        new_pw = ""
    if not isinstance(confirm_pw, str):
        confirm_pw = ""

    if new_pw or confirm_pw or current_pw:
        if not new_pw:
            return jsonify(success=False, message="يرجى إدخال كلمة المرور الجديدة"), 400
        if not confirm_pw:
            return jsonify(success=False, message="يرجى تأكيد كلمة المرور الجديدة"), 400
        if not current_pw:
            return jsonify(success=False, message="يرجى إدخال كلمة المرور الحالية"), 400
        try:
            valid = check_password_hash(user.hashed_pw, current_pw)
        except (ValueError, TypeError, AttributeError):
            valid = False
        if not valid:
            return jsonify(success=False, message="كلمة المرور الحالية غير صحيحة"), 400
        is_valid_pw, pw_message = validate_password(new_pw)
        if not is_valid_pw:
            return jsonify(success=False, message=pw_message), 400
        if new_pw != confirm_pw:
            return jsonify(success=False, message="كلمة المرور الجديدة غير متطابقة"), 400
        if current_pw == new_pw:
            return jsonify(success=False, message="كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية"), 400
        user.hashed_pw = generate_password_hash(new_pw)

    user.full_name = f"{full_name_ar} / {full_name_en}"
    user.full_name_ar = full_name_ar
    user.full_name_en = full_name_en
    user.phone = phone
    user.city = city or None
    user.district = district or None
    user.bio = bio or None
    if user.role == "technician" and specialization_id is not None:
        user.specialization_id = specialization_id

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("api_patch_me database error")
        return jsonify(success=False, message="حدث خطأ في قاعدة البيانات"), 503

    return jsonify(success=True, user=_user_me_payload(user))


@api_v1_bp.post("/me/profile-image")
@require_api_jwt
def api_me_profile_image():
    """Multipart upload: field `file` or `profile_image` (same storage as web)."""
    from app import MAX_PROFILE_IMAGE_BYTES, PROFILE_UPLOAD_DIR, allowed_profile_image

    user = g.api_user
    profile_image = request.files.get("file") or request.files.get("profile_image")
    if not profile_image or not profile_image.filename:
        return jsonify(success=False, message="لم يُرفع ملف صورة"), 400
    if not allowed_profile_image(profile_image.filename):
        return jsonify(success=False, message="صيغة الصورة غير مدعومة (PNG, JPG, JPEG, WEBP)"), 400
    try:
        profile_image.stream.seek(0, os.SEEK_END)
        file_size = profile_image.stream.tell()
        profile_image.stream.seek(0)
    except OSError:
        return jsonify(success=False, message="تعذر قراءة الملف"), 400
    if file_size > MAX_PROFILE_IMAGE_BYTES:
        return jsonify(success=False, message="حجم الصورة كبير جداً (الحد الأقصى 2MB)"), 400

    os.makedirs(PROFILE_UPLOAD_DIR, exist_ok=True)
    extension = profile_image.filename.rsplit(".", 1)[1].lower()
    stored_name = secure_filename(f"user_{user.user_id}_{uuid.uuid4().hex[:10]}.{extension}")
    storage_path = os.path.join(PROFILE_UPLOAD_DIR, stored_name)
    try:
        profile_image.save(storage_path)
    except OSError:
        current_app.logger.exception("api_me_profile_image save failed")
        return jsonify(success=False, message="تعذر حفظ الصورة"), 500

    user.profile_image = f"uploads/profiles/{stored_name}"
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("api_me_profile_image database error")
        return jsonify(success=False, message="حدث خطأ في قاعدة البيانات"), 503

    return jsonify(success=True, user=_user_me_payload(user))


@api_v1_bp.get("/requests")
@require_api_jwt
def api_requests_list():
    from api_service_requests import (
        list_requests_for_api_user,
        parse_request_status_query,
        pending_offers_counts,
        serialize_service_row,
        users_by_ids,
    )

    status, err = parse_request_status_query(request.args.get("status"))
    if err:
        return jsonify(success=False, message=err), 400
    u = g.api_user
    rows, distances, geo_err, geo_meta = list_requests_for_api_user(
        u, status, dict(request.args)
    )
    if geo_err:
        return jsonify(success=False, message=geo_err), 400
    if rows is None:
        return jsonify(success=False, message="غير مصرح"), 403
    ids = [r.request_id for r in rows]
    counts = pending_offers_counts(ids)
    cust_map = users_by_ids([sr.customer_id for sr in rows])
    tech_ids = [int(sr.technician_id) for sr in rows if sr.technician_id is not None]
    tech_map = users_by_ids(tech_ids) if tech_ids else {}
    items = [
        serialize_service_row(
            sr,
            counts.get(sr.request_id, 0),
            customer=cust_map.get(sr.customer_id),
            technician=tech_map.get(int(sr.technician_id)) if sr.technician_id is not None else None,
            viewer=u,
            distance_km=distances.get(int(sr.request_id)),
        )
        for sr in rows
    ]
    payload: dict[str, Any] = {"requests": items}
    if geo_meta is not None:
        payload["geo"] = geo_meta
    return jsonify(payload)


@api_v1_bp.get("/requests/<int:request_id>")
@require_api_jwt
def api_request_detail(request_id: int):
    from api_service_requests import api_can_view_request, build_request_detail_payload
    from geo_utils import parse_detail_geo_query

    sr = ServiceRequest.query.get(request_id)
    if sr is None:
        return jsonify(success=False, message="الطلب غير موجود"), 404
    if not api_can_view_request(g.api_user, sr):
        return jsonify(success=False, message="لا تملك صلاحية الوصول لهذا الطلب"), 403
    query_args = dict(request.args)
    _, geo_err = parse_detail_geo_query(query_args)
    if geo_err:
        return jsonify(success=False, message=geo_err), 400
    return jsonify(request=build_request_detail_payload(g.api_user, sr, query_args))


@api_v1_bp.get("/requests/<int:request_id>/public-profile/<int:user_id>")
@require_api_jwt
def api_request_public_profile(request_id: int, user_id: int):
    """Read-only participant profile in job context (not browse-by-id)."""
    from api_service_requests import api_can_view_request, build_public_profile_payload

    sr = ServiceRequest.query.get(request_id)
    if sr is None:
        return jsonify(success=False, message="الطلب غير موجود"), 404
    if not api_can_view_request(g.api_user, sr):
        return jsonify(success=False, message="لا تملك صلاحية الوصول لهذا الطلب"), 403
    target = User.query.get(user_id)
    if target is None:
        return jsonify(success=False, message="المستخدم غير موجود"), 404
    payload = build_public_profile_payload(g.api_user, sr, target)
    if payload is None:
        return jsonify(success=False, message="لا تملك صلاحية عرض هذا الملف"), 403
    return jsonify(profile=payload)


def _create_request_payload_from_multipart() -> dict[str, Any]:
    """Form fields for POST /requests multipart (same keys as JSON body)."""
    return {
        "service_type": request.form.get("service_type"),
        "description": request.form.get("description", ""),
        "city": request.form.get("city", ""),
        "district": request.form.get("district", ""),
        "address": request.form.get("address", ""),
        "preferred_date": request.form.get("preferred_date"),
        "preferred_time": request.form.get("preferred_time"),
        "notes": request.form.get("notes", ""),
        "latitude": request.form.get("latitude"),
        "longitude": request.form.get("longitude"),
    }


@api_v1_bp.post("/requests")
@require_api_jwt
def api_create_request():
    ct = (request.content_type or "").lower()
    if "multipart/form-data" in ct:
        data = _create_request_payload_from_multipart()
        att = request.files.get("attachment") or request.files.get("media")
        attachment_file = att if att and att.filename else None
        body, code = customer_create_request(g.api_user, data, attachment_file=attachment_file)
        return _action_response_with_request(g.api_user, body, code)

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(success=False, message="يجب إرسال JSON صالح أو multipart/form-data"), 400
    body, code = customer_create_request(g.api_user, data)
    return _action_response_with_request(g.api_user, body, code)


@api_v1_bp.route(
    "/requests/<int:request_id>/offers",
    methods=["POST", "PUT", "PATCH"],
)
@require_api_jwt
def api_upsert_offer(request_id: int):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(success=False, message="يجب إرسال JSON صالح"), 400
    body, code = technician_submit_offer(g.api_user, request_id, data)
    return _action_response_with_request(g.api_user, body, code)


@api_v1_bp.post("/offers/<int:offer_id>/choose")
@require_api_jwt
def api_choose_offer(offer_id: int):
    body, code = customer_choose_offer(g.api_user, offer_id)
    return _action_response_with_request(g.api_user, body, code)


@api_v1_bp.post("/requests/<int:request_id>/accept")
@require_api_jwt
def api_tech_accept(request_id: int):
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify(success=False, message="يجب إرسال JSON صالح"), 400
    body, code = technician_accept_request(g.api_user, request_id, data)
    return _action_response_with_request(g.api_user, body, code)


@api_v1_bp.post("/requests/<int:request_id>/complete")
@require_api_jwt
def api_tech_complete(request_id: int):
    body, code = technician_complete_request(g.api_user, request_id)
    return _action_response_with_request(g.api_user, body, code)


@api_v1_bp.post("/requests/<int:request_id>/pay")
@require_api_jwt
def api_pay(request_id: int):
    body, code = customer_pay_request(g.api_user, request_id)
    return _action_response_with_request(g.api_user, body, code)


@api_v1_bp.post("/requests/<int:request_id>/rating")
@require_api_jwt
def api_rating(request_id: int):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(success=False, message="يجب إرسال JSON صالح"), 400
    body, code = customer_submit_rating(g.api_user, request_id, data)
    return _action_response_with_request(g.api_user, body, code)


@api_v1_bp.get("/me/portfolio")
@require_api_jwt
def api_me_portfolio_list():
    body, code = list_portfolio_for_owner(g.api_user)
    return jsonify(body), code


@api_v1_bp.post("/me/portfolio")
@require_api_jwt
def api_me_portfolio_create():
    up = request.files.get("file") or request.files.get("image")
    caption = request.form.get("caption")
    category = request.form.get("category")
    work_date = request.form.get("work_date")
    body, code = create_portfolio_item(g.api_user, up, caption, category, work_date)
    return jsonify(body), code


@api_v1_bp.patch("/me/portfolio/<int:item_id>")
@require_api_jwt
def api_me_portfolio_patch(item_id: int):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(success=False, message="يجب إرسال JSON صالح"), 400
    patch_caption = "caption" in data
    patch_category = "category" in data
    patch_work_date = "work_date" in data
    if not patch_caption and not patch_category and not patch_work_date:
        return jsonify(success=False, message="لا حقول للتحديث"), 400
    body, code = patch_portfolio_item(
        g.api_user,
        item_id,
        data.get("caption"),
        data.get("category"),
        data.get("work_date"),
        patch_caption=patch_caption,
        patch_category=patch_category,
        patch_work_date=patch_work_date,
    )
    return jsonify(body), code


@api_v1_bp.delete("/me/portfolio/<int:item_id>")
@require_api_jwt
def api_me_portfolio_delete(item_id: int):
    body, code = delete_portfolio_item(g.api_user, item_id)
    return jsonify(body), code


@api_v1_bp.put("/me/portfolio/reorder")
@require_api_jwt
def api_me_portfolio_reorder():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(success=False, message="يجب إرسال JSON صالح"), 400
    body, code = reorder_portfolio_items(g.api_user, data.get("ordered_ids"))
    return jsonify(body), code


@api_v1_bp.post("/auth/login")
def api_login():
    from app import sanitize_input, validate_email

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(success=False, message="يجب إرسال JSON صالح"), 400

    email = sanitize_input(str(data.get("email", "") or ""))
    password = data.get("password")
    if not isinstance(password, str):
        password = ""
    if not email or not password:
        return jsonify(success=False, message="البريد الإلكتروني وكلمة المرور مطلوبان"), 400
    if not validate_email(email):
        return jsonify(success=False, message="يرجى إدخال بريد إلكتروني صحيح"), 400

    try:
        user = User.query.filter_by(email=email).first()
        pw_hash = getattr(user, "hashed_pw", None) if user is not None else None
        if not pw_hash:
            valid = False
        else:
            try:
                valid = check_password_hash(pw_hash, password)
            except (ValueError, TypeError, AttributeError):
                valid = False
        if not valid:
            return jsonify(success=False, message="البريد الإلكتروني أو كلمة المرور غير صحيحة"), 401

        token = create_access_token(user.user_id)
        return jsonify(access_token=token, user=_user_token_payload(user))
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("api_login database error")
        return jsonify(success=False, message="حدث خطأ في قاعدة البيانات"), 503
    except Exception:
        current_app.logger.exception("api_login failed")
        return jsonify(success=False, message="حدث خطأ في الخادم"), 500


@api_v1_bp.post("/auth/register")
def api_register():
    from app import sanitize_input, validate_email, validate_password, validate_phone

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(success=False, message="يجب إرسال JSON صالح"), 400

    full_name_ar = sanitize_input(str(data.get("full_name_ar", "") or ""))
    full_name_en = sanitize_input(str(data.get("full_name_en", "") or ""))
    email = sanitize_input(str(data.get("email", "") or ""))
    password = data.get("password")
    if not isinstance(password, str):
        password = ""
    phone = sanitize_input(str(data.get("phone", "") or ""))
    user_type = data.get("user_type")
    if not isinstance(user_type, str):
        user_type = None
    user_type = user_type.strip().lower() if user_type else None

    specialization_id: int | None = None
    if user_type == "technician":
        spec_raw = data.get("specialization_id")
        if spec_raw is None or spec_raw == "":
            specialization_id = None
        else:
            try:
                specialization_id = int(spec_raw)
            except (TypeError, ValueError):
                return jsonify(success=False, message="معرف التخصص غير صالح"), 400

    if not full_name_ar or not full_name_en:
        return jsonify(success=False, message="يرجى إدخال الاسم الكامل باللغتين"), 400
    if not validate_email(email):
        return jsonify(success=False, message="يرجى إدخال بريد إلكتروني صحيح"), 400
    if not validate_phone(phone):
        return jsonify(success=False, message="يرجى إدخال رقم هاتف صحيح"), 400
    is_valid_pw, pw_message = validate_password(password)
    if not is_valid_pw:
        return jsonify(success=False, message=pw_message), 400
    if user_type not in ("customer", "technician"):
        return jsonify(success=False, message="يرجى اختيار نوع المستخدم"), 400
    if user_type == "technician" and specialization_id is None:
        return jsonify(success=False, message="يرجى اختيار التخصص"), 400
    if User.query.filter_by(email=email).first():
        return jsonify(success=False, message="البريد الإلكتروني مستخدم بالفعل"), 409
    if user_type == "technician":
        spec = Specialization.query.get(specialization_id)
        if not spec:
            return jsonify(success=False, message="التخصص المختار غير موجود"), 400

    tech_spec_id: int | None = specialization_id if user_type == "technician" else None

    user = User(
        email=email,
        hashed_pw=generate_password_hash(password),
        full_name=f"{full_name_ar} / {full_name_en}",
        full_name_ar=full_name_ar,
        full_name_en=full_name_en,
        phone=phone,
        role=user_type,
        specialization_id=tech_spec_id,
    )
    try:
        db.session.add(user)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify(success=False, message="حدث خطأ في قاعدة البيانات"), 500

    token = create_access_token(user.user_id)
    return jsonify(access_token=token, user=_user_token_payload(user)), 201
