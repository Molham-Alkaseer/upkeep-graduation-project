"""JSON serializers and access rules for /api/v1 service request routes."""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import joinedload

from models import (
    Invoice,
    Payment,
    RequestTimeline,
    ServiceRequest,
    TechnicianOffer,
    TechnicianRating,
    User,
    db,
)
from geo_utils import haversine_km, parse_detail_geo_query, parse_list_geo_query, round_distance_km
from portfolio_service import list_portfolio_for_technician_public
from service_request_actions import build_track_status_payload, coerce_int, timeline_table_exists

_ALLOWED_REQUEST_STATUSES = frozenset(
    {"pending", "assigned", "in_progress", "completed", "cancelled"}
)


def parse_request_status_query(raw: str | None) -> tuple[str | None, str | None]:
    """Return (status or None, error_message or None)."""
    if raw is None or str(raw).strip() == "":
        return None, None
    s = str(raw).strip().lower()
    if s not in _ALLOWED_REQUEST_STATUSES:
        return None, "قيمة حالة الطلب غير صالحة"
    return s, None


def query_requests_for_api_user(user: User, status: str | None):
    """Same visibility filters as customer dashboard and /tech dashboard."""
    if user.role == "admin":
        q = ServiceRequest.query
        if status:
            q = q.filter_by(status=status)
        return q.order_by(ServiceRequest.created_at.desc())
    if user.role == "customer":
        q = ServiceRequest.query.filter_by(customer_id=user.user_id)
        if status:
            q = q.filter_by(status=status)
        return q.order_by(ServiceRequest.created_at.desc())
    if user.role == "technician":
        q = ServiceRequest.query.filter(
            (
                (ServiceRequest.status == "pending")
                & (ServiceRequest.service_type == user.specialization_id)
            )
            | (ServiceRequest.technician_id == user.user_id)
        )
        if status:
            q = q.filter_by(status=status)
        return q.order_by(ServiceRequest.created_at.desc())
    return None


def _is_open_market_pending(sr: ServiceRequest, user: User) -> bool:
    if sr.status != "pending" or sr.technician_id is not None:
        return False
    req_spec = coerce_int(sr.service_type)
    tech_spec = coerce_int(user.specialization_id)
    return req_spec is not None and tech_spec is not None and req_spec == tech_spec


def _request_distance_km(
    tech_lat: float, tech_lng: float, sr: ServiceRequest
) -> float | None:
    if sr.latitude is None or sr.longitude is None:
        return None
    return haversine_km(tech_lat, tech_lng, sr.latitude, sr.longitude)


def filter_technician_requests_by_geo(
    rows: list[ServiceRequest],
    user: User,
    tech_lat: float,
    tech_lng: float,
    radius_km: float,
    *,
    sort_by_distance: bool,
) -> tuple[list[ServiceRequest], dict[int, float]]:
    """
    Technician list with geo: assigned-to-me always; open-market pending in radius when pinned;
    open-market pending without coords appended at end (no distance_km).
    """
    included: list[tuple[ServiceRequest, float | None]] = []
    seen: set[int] = set()

    for sr in rows:
        if sr.technician_id != user.user_id:
            continue
        dist = _request_distance_km(tech_lat, tech_lng, sr)
        included.append((sr, dist))
        seen.add(int(sr.request_id))

    for sr in rows:
        rid = int(sr.request_id)
        if rid in seen:
            continue
        if not _is_open_market_pending(sr, user):
            continue
        if sr.latitude is None or sr.longitude is None:
            included.append((sr, None))
            seen.add(rid)
            continue
        dist = haversine_km(tech_lat, tech_lng, sr.latitude, sr.longitude)
        if dist <= radius_km:
            included.append((sr, dist))
            seen.add(rid)

    if sort_by_distance:
        included.sort(
            key=lambda item: (
                item[1] is None,
                item[1] if item[1] is not None else float("inf"),
                -(item[0].created_at.timestamp() if item[0].created_at else 0),
            )
        )
    else:
        included.sort(
            key=lambda item: item[0].created_at.timestamp() if item[0].created_at else 0,
            reverse=True,
        )

    out_rows = [sr for sr, _ in included]
    distances: dict[int, float] = {}
    for sr, dist in included:
        if dist is not None:
            distances[int(sr.request_id)] = round_distance_km(dist)
    return out_rows, distances


def count_open_pending_outside_radius(
    rows: list[ServiceRequest],
    user: User,
    tech_lat: float,
    tech_lng: float,
    radius_km: float,
) -> int:
    """Open-market pending jobs with a pin but outside the technician search radius."""
    count = 0
    for sr in rows:
        if not _is_open_market_pending(sr, user):
            continue
        if sr.latitude is None or sr.longitude is None:
            continue
        dist = haversine_km(tech_lat, tech_lng, sr.latitude, sr.longitude)
        if dist > radius_km:
            count += 1
    return count


def list_requests_for_api_user(
    user: User,
    status: str | None,
    query_args: dict[str, Any] | None = None,
) -> tuple[list[ServiceRequest] | None, dict[int, float], str | None, dict[str, Any] | None]:
    """
    Resolve visible requests for GET /api/v1/requests.

    Returns (rows, distance_km_by_request_id, error_message, geo_meta or None).
    geo_meta keys when technician geo list is active: radius_km, outside_radius_count.
    """
    q = query_requests_for_api_user(user, status)
    if q is None:
        return None, {}, None, None

    rows = q.all()
    distances: dict[int, float] = {}

    if user.role != "technician" or not query_args:
        return rows, distances, None, None

    tech_point, radius_km, sort_by_distance, err = parse_list_geo_query(query_args)
    if err:
        return None, {}, err, None
    if tech_point is None:
        return rows, distances, None, None

    tech_lat, tech_lng = tech_point
    outside_count = count_open_pending_outside_radius(
        rows, user, tech_lat, tech_lng, radius_km
    )
    filtered_rows, distances = filter_technician_requests_by_geo(
        rows,
        user,
        tech_lat,
        tech_lng,
        radius_km,
        sort_by_distance=sort_by_distance,
    )
    geo_meta = {
        "radius_km": radius_km,
        "outside_radius_count": outside_count,
    }
    return filtered_rows, distances, None, geo_meta


def api_can_view_request_coordinates(user: User, sr: ServiceRequest) -> bool:
    """Exact coordinates: customer, admin, or assigned technician."""
    if user.role == "admin":
        return True
    if user.role == "customer" and sr.customer_id == user.user_id:
        return True
    if user.role == "technician" and sr.technician_id == user.user_id:
        return True
    return False


def api_should_redact_location(user: User, sr: ServiceRequest) -> bool:
    """Hide street address and exact coords for open-market pending (unassigned technician)."""
    if user.role != "technician":
        return False
    if sr.technician_id == user.user_id:
        return False
    return _is_open_market_pending(sr, user)


def _apply_request_coordinates(row: dict[str, Any], sr: ServiceRequest) -> None:
    row["latitude"] = sr.latitude
    row["longitude"] = sr.longitude


def api_can_view_request(user: User, sr: ServiceRequest) -> bool:
    """Mirror /track/<id> authorization (customer, technician, admin)."""
    if user.role == "admin":
        return True
    if user.role == "customer":
        return sr.customer_id == user.user_id
    if user.role != "technician":
        return False
    if sr.technician_id not in (None, user.user_id):
        return False
    if sr.technician_id is None and sr.status == "pending":
        req_spec = coerce_int(sr.service_type)
        tech_spec = coerce_int(user.specialization_id)
        return req_spec is not None and tech_spec is not None and req_spec == tech_spec
    return True


def api_can_submit_offer(user: User, sr: ServiceRequest) -> bool:
    if user.role != "technician":
        return False
    if sr.technician_id is None and sr.status == "pending":
        req_spec = coerce_int(sr.service_type)
        tech_spec = coerce_int(user.specialization_id)
        return req_spec is not None and tech_spec is not None and req_spec == tech_spec
    return False


def _money(v: Any) -> str:
    return str(Decimal(str(v)).quantize(Decimal("0.01")))


def _dt_iso(dt: Any) -> str | None:
    if dt is None:
        return None
    return dt.isoformat() + "Z"


def pending_offers_counts(request_ids: list[int]) -> dict[int, int]:
    if not request_ids:
        return {}
    rows = (
        db.session.query(TechnicianOffer.request_id, func.count(TechnicianOffer.offer_id))
        .filter(
            TechnicianOffer.request_id.in_(request_ids),
            TechnicianOffer.status == "pending",
        )
        .group_by(TechnicianOffer.request_id)
        .all()
    )
    return {int(rid): int(cnt) for rid, cnt in rows}


def users_by_ids(user_ids: list[int]) -> dict[int, User]:
    ids = sorted({int(i) for i in user_ids if i is not None})
    if not ids:
        return {}
    rows = User.query.filter(User.user_id.in_(ids)).all()
    return {int(u.user_id): u for u in rows}


def technician_rating_summaries(technician_ids: list[int]) -> dict[int, dict[str, Any]]:
    """Aggregate stars for each technician (same shape as /api/v1/me rating_summary)."""
    ids = sorted({int(i) for i in technician_ids if i is not None})
    if not ids:
        return {}
    rows = (
        db.session.query(
            TechnicianRating.technician_id,
            func.avg(TechnicianRating.stars),
            func.count(TechnicianRating.rating_id),
        )
        .filter(TechnicianRating.technician_id.in_(ids))
        .group_by(TechnicianRating.technician_id)
        .all()
    )
    out: dict[int, dict[str, Any]] = {}
    for tid, avg, cnt in rows:
        tid_i = int(tid)
        out[tid_i] = {
            "avg_stars": round(float(avg), 2) if avg is not None else None,
            "ratings_count": int(cnt),
        }
    return out


def _split_full_name_for_api(full_name: str) -> tuple[str, str]:
    s = (full_name or "").strip()
    if "/" in s:
        left, _, right = s.partition("/")
        return left.strip(), right.strip()
    return s, ""


def customer_name_parts(user: User) -> tuple[str, str]:
    if user.full_name_ar and user.full_name_en:
        return user.full_name_ar.strip(), user.full_name_en.strip()
    return _split_full_name_for_api(user.full_name or "")


def serialize_service_row(
    sr: ServiceRequest,
    pending_offers_count: int | None = None,
    customer: User | None = None,
    technician: User | None = None,
    *,
    viewer: User | None = None,
    distance_km: float | None = None,
) -> dict[str, Any]:
    spec = sr.service
    row: dict[str, Any] = {
        "request_id": sr.request_id,
        "customer_id": sr.customer_id,
        "technician_id": sr.technician_id,
        "service_type": int(sr.service_type) if sr.service_type is not None else None,
        "service": None,
        "status": sr.status,
        "payment_status": sr.payment_status,
        "description": sr.description,
        "city": sr.city,
        "district": sr.district,
        "address": None if (viewer and api_should_redact_location(viewer, sr)) else sr.address,
        "preferred_date": sr.preferred_date.isoformat() if sr.preferred_date else None,
        "preferred_time": sr.preferred_time,
        "notes": sr.notes,
        "created_at": _dt_iso(sr.created_at),
        "completed_at": _dt_iso(sr.completed_at),
    }
    raw_att = (getattr(sr, "attachment_path", None) or "").strip()
    if raw_att:
        row["attachment_kind"] = getattr(sr, "attachment_kind", None) or None
        row["attachment_url_path"] = f"/static/{raw_att.lstrip('/')}"
    else:
        row["attachment_kind"] = None
        row["attachment_url_path"] = None
    if spec is not None:
        row["service"] = {
            "spec_id": spec.spec_id,
            "name_ar": spec.name_ar,
            "name_en": spec.name_en,
        }
    if pending_offers_count is not None:
        row["pending_offers_count"] = pending_offers_count
    if viewer and api_can_view_request_coordinates(viewer, sr):
        _apply_request_coordinates(row, sr)
    if distance_km is not None:
        row["distance_km"] = round_distance_km(distance_km)
    row["customer"] = serialize_customer_for_request(customer)
    row["technician"] = serialize_technician_for_offer(technician)
    return row


def technician_display_name(u: User | None) -> str | None:
    if u is None:
        return None
    if u.full_name_ar:
        return u.full_name_ar.strip()
    if u.full_name:
        return u.full_name.split("/")[0].strip()
    return u.email


def serialize_customer_for_request(user: User | None) -> dict[str, Any] | None:
    if user is None:
        return None
    name_ar, name_en = customer_name_parts(user)
    return {
        "user_id": int(user.user_id),
        "full_name_ar": name_ar or None,
        "full_name_en": name_en or None,
        "display_name": technician_display_name(user),
        "phone": user.phone,
        "city": user.city,
        "district": user.district,
        "profile_image": user.profile_image,
    }


def serialize_technician_for_offer(tech: User | None) -> dict[str, Any] | None:
    if tech is None:
        return None
    name_ar, name_en = customer_name_parts(tech)
    payload: dict[str, Any] = {
        "user_id": int(tech.user_id),
        "full_name_ar": name_ar or None,
        "full_name_en": name_en or None,
        "display_name": technician_display_name(tech),
        "phone": tech.phone,
        "city": tech.city,
        "district": tech.district,
        "bio": tech.bio,
        "profile_image": tech.profile_image,
        "specialization": None,
    }
    spec = tech.specialization
    if spec is not None:
        payload["specialization"] = {
            "spec_id": spec.spec_id,
            "name_ar": spec.name_ar,
            "name_en": spec.name_en,
        }
    return payload


def _empty_rating_summary() -> dict[str, Any]:
    return {"avg_stars": None, "ratings_count": 0}


def serialize_offer(
    o: TechnicianOffer,
    technician: User | None,
    rating_summary: dict[str, Any] | None,
) -> dict[str, Any]:
    rs = rating_summary if rating_summary is not None else _empty_rating_summary()
    return {
        "offer_id": o.offer_id,
        "technician_id": o.technician_id,
        "technician_display": technician_display_name(technician),
        "technician": serialize_technician_for_offer(technician),
        "rating_summary": rs,
        "amount": _money(o.amount),
        "tax_rate": _money(o.tax_rate),
        "tax_amount": _money(o.tax_amount),
        "total_amount": _money(o.total_amount),
        "note": o.note,
        "status": o.status,
        "created_at": _dt_iso(o.created_at),
    }


def serialize_invoice_summary(inv: Invoice) -> dict[str, Any]:
    return {
        "invoice_id": inv.invoice_id,
        "request_id": inv.request_id,
        "offer_id": inv.offer_id,
        "invoice_number": inv.invoice_number,
        "subtotal": _money(inv.subtotal),
        "tax_rate": _money(inv.tax_rate),
        "tax_amount": _money(inv.tax_amount),
        "total": _money(inv.total),
        "payment_status": inv.payment_status,
        "issued_at": _dt_iso(inv.issued_at),
    }


def serialize_payment(p: Payment) -> dict[str, Any]:
    return {
        "payment_id": p.payment_id,
        "amount": _money(p.amount),
        "method": p.method,
        "status": p.status,
        "transaction_id": p.transaction_id,
        "created_at": _dt_iso(p.created_at),
    }


def serialize_timeline_entry(entry: RequestTimeline) -> dict[str, Any]:
    row: dict[str, Any] = {
        "timeline_id": entry.timeline_id,
        "status": entry.status,
        "note": entry.note,
        "actor_id": entry.actor_id,
        "created_at": _dt_iso(entry.created_at),
    }
    actor = getattr(entry, "actor", None)
    if actor is not None:
        name_ar, name_en = customer_name_parts(actor)
        row["actor_full_name_ar"] = name_ar or None
        row["actor_full_name_en"] = name_en or None
    else:
        row["actor_full_name_ar"] = None
        row["actor_full_name_en"] = None
    return row


def serialize_rating(r: TechnicianRating) -> dict[str, Any]:
    return {
        "rating_id": r.rating_id,
        "stars": r.stars,
        "comment": r.comment,
        "created_at": _dt_iso(r.created_at),
    }


def _detail_distance_km_for_viewer(
    user: User,
    sr: ServiceRequest,
    query_args: dict[str, Any] | None,
) -> float | None:
    if user.role != "technician" or not query_args:
        return None
    tech_point, err = parse_detail_geo_query(query_args)
    if err or tech_point is None:
        return None
    tech_lat, tech_lng = tech_point
    dist = _request_distance_km(tech_lat, tech_lng, sr)
    if dist is None:
        return None
    return round_distance_km(dist)


def build_request_detail_payload(
    user: User,
    sr: ServiceRequest,
    query_args: dict[str, Any] | None = None,
) -> dict[str, Any]:
    pending_map = pending_offers_counts([sr.request_id])
    cust = sr.customer
    tech_user = sr.technician if sr.technician_id is not None else None
    distance_km = _detail_distance_km_for_viewer(user, sr, query_args)
    base = serialize_service_row(
        sr,
        pending_map.get(sr.request_id, 0),
        customer=cust,
        technician=tech_user,
        viewer=user,
        distance_km=distance_km,
    )

    offers = sr.offers.order_by(TechnicianOffer.total_amount.asc()).all()
    tech_ids = {o.technician_id for o in offers}
    tech_by_id = users_by_ids(list(tech_ids)) if tech_ids else {}
    rating_by_tech = technician_rating_summaries(list(tech_ids)) if tech_ids else {}
    offers_json = [
        serialize_offer(o, tech_by_id.get(o.technician_id), rating_by_tech.get(int(o.technician_id)))
        for o in offers
    ]

    invoice = Invoice.query.filter_by(request_id=sr.request_id).first()
    invoice_json = serialize_invoice_summary(invoice) if invoice else None

    latest_payment = (
        Payment.query.filter_by(request_id=sr.request_id).order_by(Payment.created_at.desc()).first()
    )
    payment_json = serialize_payment(latest_payment) if latest_payment else None

    if timeline_table_exists():
        timeline_rows = (
            RequestTimeline.query.options(joinedload(RequestTimeline.actor))
            .filter_by(request_id=sr.request_id)
            .order_by(RequestTimeline.created_at.asc())
            .all()
        )
        timeline = [serialize_timeline_entry(e) for e in timeline_rows]
    else:
        timeline = []

    rating = TechnicianRating.query.filter_by(request_id=sr.request_id).first()
    rating_json = serialize_rating(rating) if rating else None

    my_offer = None
    if user.role == "technician":
        mo = TechnicianOffer.query.filter_by(
            request_id=sr.request_id, technician_id=user.user_id
        ).first()
        if mo:
            my_offer = serialize_offer(mo, user, rating_by_tech.get(int(user.user_id)))

    detail: dict[str, Any] = {
        **base,
        "offers": offers_json,
        "invoice": invoice_json,
        "latest_payment": payment_json,
        "timeline": timeline,
        "track_status": build_track_status_payload(sr),
        "can_submit_offer": api_can_submit_offer(user, sr),
        "my_offer": my_offer,
        "rating": rating_json,
    }
    return detail


def profile_image_url_path(user: User | None) -> str | None:
    """Same absolute-path convention as GET /api/v1/me (`/static/...` for mobile + web)."""
    if user is None:
        return None
    raw_path = (user.profile_image or "").strip()
    return f"/static/{raw_path.lstrip('/')}" if raw_path else None


def can_view_public_profile(viewer: User, sr: ServiceRequest, target: User) -> bool:
    """
    Authorize read-only 'profile peek' for participants on the same service request.

    Privacy (aligned with offer cards / request detail in this codebase):
    - Not a public directory: caller must already pass api_can_view_request (same job context).
    - Customer profile: visible to the owning customer (self), technicians who may open this
      request, and admins — same phone/city fields as TechnicianRequestDetail API already embeds.
    - Technician profile: visible if this technician is the assigned tech OR has any offer on
      this request; customers see the same tech fields as on each OfferCard.
    """
    if not api_can_view_request(viewer, sr):
        return False
    tid = int(target.user_id)
    cid = int(sr.customer_id)

    if tid == cid:
        if viewer.role == "admin":
            return True
        if viewer.role == "customer" and int(viewer.user_id) == cid:
            return True
        if viewer.role == "technician":
            return True
        return False

    if getattr(target, "role", None) != "technician":
        return False

    if sr.technician_id is not None and int(sr.technician_id) == tid:
        return True

    offer = TechnicianOffer.query.filter_by(request_id=sr.request_id, technician_id=tid).first()
    return offer is not None


def build_public_profile_payload(viewer: User, sr: ServiceRequest, target: User) -> dict[str, Any] | None:
    """JSON for GET .../public-profile/... ; returns None if forbidden or invalid target."""
    if not can_view_public_profile(viewer, sr, target):
        return None

    tid = int(target.user_id)
    cid = int(sr.customer_id)

    if tid == cid:
        row = serialize_customer_for_request(target)
        if row is None:
            return None
        row["role"] = "customer"
        row["profile_image_url_path"] = profile_image_url_path(target)
        return row

    rs = technician_rating_summaries([tid]).get(tid) or _empty_rating_summary()
    tech_row = serialize_technician_for_offer(target)
    if tech_row is None:
        return None
    tech_row["role"] = "technician"
    tech_row["profile_image_url_path"] = profile_image_url_path(target)
    tech_row["rating_summary"] = rs
    tech_row["portfolio"] = list_portfolio_for_technician_public(tid)
    return tech_row
