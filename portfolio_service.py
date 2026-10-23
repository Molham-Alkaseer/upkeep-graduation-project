from __future__ import annotations

import os
import uuid
from datetime import date, datetime
from typing import Any

from flask import current_app
from sqlalchemy import func
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from models import TechnicianPortfolioItem, User, db
from portfolio_constants import (
    PORTFOLIO_CAPTION_MAX_LEN,
    PORTFOLIO_CATEGORY_MAX_LEN,
    PORTFOLIO_MAX_IMAGE_BYTES,
    PORTFOLIO_MAX_ITEMS,
    PORTFOLIO_UPLOAD_SUBDIR,
    allowed_portfolio_image,
    portfolio_limits_dict,
)


def static_url_path(relative_under_static: str) -> str:
    raw = (relative_under_static or "").strip().replace("\\", "/")
    return f"/static/{raw.lstrip('/')}" if raw else ""


def _abs_path_for_stored_media(app_root: str, media_path: str) -> str | None:
    clean = (media_path or "").replace("\\", "/").strip()
    if not clean or ".." in clean or clean.startswith("/"):
        return None
    if not clean.startswith("uploads/"):
        return None
    return os.path.join(app_root, "static", clean)


def safe_delete_stored_file(app_root: str, media_path: str) -> None:
    ap = _abs_path_for_stored_media(app_root, media_path)
    if ap and os.path.isfile(ap):
        try:
            os.remove(ap)
        except OSError:
            current_app.logger.warning("Could not delete portfolio file: %s", ap)


def _count_items(technician_id: int) -> int:
    return int(
        db.session.query(func.count(TechnicianPortfolioItem.portfolio_item_id))
        .filter(TechnicianPortfolioItem.technician_id == technician_id)
        .scalar()
        or 0
    )


def _next_sort_order(technician_id: int) -> int:
    m = (
        db.session.query(func.max(TechnicianPortfolioItem.sort_order))
        .filter(TechnicianPortfolioItem.technician_id == technician_id)
        .scalar()
    )
    return int(m) + 1 if m is not None else 0


def serialize_portfolio_item_public(item: TechnicianPortfolioItem) -> dict[str, Any]:
    rel = (item.media_path or "").strip()
    path = static_url_path(rel)
    kind = (item.media_kind or "image").strip() or "image"
    wd = item.work_date.isoformat() if item.work_date is not None else None
    return {
        "portfolio_item_id": int(item.portfolio_item_id),
        "caption": item.caption,
        "category": item.category,
        "work_date": wd,
        "media_kind": kind,
        "thumb_url_path": path,
        "media_url_path": path,
    }


def serialize_portfolio_item_owner(item: TechnicianPortfolioItem) -> dict[str, Any]:
    out = serialize_portfolio_item_public(item)
    out["sort_order"] = int(item.sort_order)
    out["created_at"] = item.created_at.isoformat() + "Z" if item.created_at else None
    return out


def list_portfolio_for_technician_public(technician_id: int) -> list[dict[str, Any]]:
    rows = (
        TechnicianPortfolioItem.query.filter_by(technician_id=technician_id)
        .order_by(TechnicianPortfolioItem.sort_order.asc(), TechnicianPortfolioItem.portfolio_item_id.asc())
        .all()
    )
    return [serialize_portfolio_item_public(r) for r in rows]


def list_portfolio_for_owner(user: User) -> tuple[dict[str, Any], int]:
    if user.role != "technician":
        return {"success": False, "message": "هذه الميزة للفنيين فقط"}, 403
    tid = int(user.user_id)
    rows = (
        TechnicianPortfolioItem.query.filter_by(technician_id=tid)
        .order_by(TechnicianPortfolioItem.sort_order.asc(), TechnicianPortfolioItem.portfolio_item_id.asc())
        .all()
    )
    body = {
        "success": True,
        "limits": portfolio_limits_dict(),
        "items": [serialize_portfolio_item_owner(r) for r in rows],
    }
    return body, 200


def _parse_work_date(raw: Any) -> date | None | str:
    """Returns date, None (explicit clear), or error code str."""
    if raw is None or raw == "":
        return None
    if isinstance(raw, date) and not isinstance(raw, datetime):
        return raw
    s = str(raw).strip()
    if s == "":
        return None
    try:
        parts = s[:10].split("-")
        if len(parts) != 3:
            return "bad_date"
        y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
        return date(y, m, d)
    except (ValueError, TypeError):
        return "bad_date"


def _sanitize_caption(raw: Any) -> tuple[str | None, str | None]:
    if raw is None:
        return None, "أدخل وصفاً قصيراً للصورة"
    s = str(raw).strip()
    if not s:
        return None, "أدخل وصفاً قصيراً للصورة"
    if len(s) > PORTFOLIO_CAPTION_MAX_LEN:
        return None, f"الوصف طويل جداً (الحد {PORTFOLIO_CAPTION_MAX_LEN} حرفاً)"
    return s, None


def _sanitize_category(raw: Any) -> tuple[str | None, str | None]:
    if raw is None or raw == "":
        return None, None
    s = str(raw).strip()
    if len(s) > PORTFOLIO_CATEGORY_MAX_LEN:
        return None, f"التصنيف طويل جداً (الحد {PORTFOLIO_CATEGORY_MAX_LEN} حرفاً)"
    return s or None, None


def create_portfolio_item(
    user: User,
    file_storage: FileStorage | None,
    caption_raw: Any,
    category_raw: Any,
    work_date_raw: Any,
) -> tuple[dict[str, Any], int]:
    if user.role != "technician":
        return {"success": False, "message": "هذه الميزة للفنيين فقط"}, 403
    if not file_storage or not file_storage.filename:
        return {"success": False, "message": "يرجى اختيار صورة"}, 400
    if not allowed_portfolio_image(file_storage.filename):
        return {"success": False, "message": "صيغة الصورة غير مدعومة"}, 400

    tid = int(user.user_id)
    if _count_items(tid) >= PORTFOLIO_MAX_ITEMS:
        return {"success": False, "message": f"الحد الأقصى {PORTFOLIO_MAX_ITEMS} عنصر في المعرض"}, 400

    caption, err = _sanitize_caption(caption_raw)
    if err:
        return {"success": False, "message": err}, 400
    category, cerr = _sanitize_category(category_raw)
    if cerr:
        return {"success": False, "message": cerr}, 400

    wd = _parse_work_date(work_date_raw)
    if wd == "bad_date":
        return {"success": False, "message": "تاريخ العمل غير صالح"}, 400

    try:
        file_storage.stream.seek(0, os.SEEK_END)
        size = file_storage.stream.tell()
        file_storage.stream.seek(0)
    except OSError:
        return {"success": False, "message": "تعذر قراءة الملف"}, 400
    if size > PORTFOLIO_MAX_IMAGE_BYTES:
        return {"success": False, "message": "حجم الصورة كبير جداً"}, 400

    ext = file_storage.filename.rsplit(".", 1)[1].lower()
    uid_hex = uuid.uuid4().hex[:12]
    stored_name = secure_filename(f"tech_{tid}_{uid_hex}.{ext}")
    subdir = os.path.join("static", PORTFOLIO_UPLOAD_SUBDIR, str(tid))
    app_root = current_app.root_path
    out_dir = os.path.join(app_root, subdir)
    os.makedirs(out_dir, exist_ok=True)
    fs_path = os.path.join(out_dir, stored_name)
    rel_path = f"{PORTFOLIO_UPLOAD_SUBDIR}/{tid}/{stored_name}"

    try:
        file_storage.save(fs_path)
    except OSError:
        current_app.logger.exception("portfolio save failed")
        return {"success": False, "message": "تعذر حفظ الصورة"}, 500

    item = TechnicianPortfolioItem(
        technician_id=tid,
        sort_order=_next_sort_order(tid),
        caption=caption,
        category=category,
        work_date=wd,
        media_kind="image",
        media_path=rel_path,
    )
    db.session.add(item)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        safe_delete_stored_file(app_root, rel_path)
        current_app.logger.exception("portfolio commit failed")
        return {"success": False, "message": "حدث خطأ في قاعدة البيانات"}, 503

    return {
        "success": True,
        "limits": portfolio_limits_dict(),
        "item": serialize_portfolio_item_owner(item),
    }, 201


def delete_portfolio_item(user: User, item_id: int) -> tuple[dict[str, Any], int]:
    if user.role != "technician":
        return {"success": False, "message": "هذه الميزة للفنيين فقط"}, 403
    tid = int(user.user_id)
    item = TechnicianPortfolioItem.query.filter_by(
        portfolio_item_id=item_id, technician_id=tid
    ).first()
    if item is None:
        return {"success": False, "message": "العنصر غير موجود"}, 404

    media_path = item.media_path
    db.session.delete(item)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("portfolio delete failed")
        return {"success": False, "message": "حدث خطأ في قاعدة البيانات"}, 503

    safe_delete_stored_file(current_app.root_path, media_path)
    _renumber_sort_orders(tid)
    return {"success": True, "limits": portfolio_limits_dict()}, 200


def _renumber_sort_orders(technician_id: int) -> None:
    rows = (
        TechnicianPortfolioItem.query.filter_by(technician_id=technician_id)
        .order_by(TechnicianPortfolioItem.sort_order.asc(), TechnicianPortfolioItem.portfolio_item_id.asc())
        .all()
    )
    for i, r in enumerate(rows):
        r.sort_order = i
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("portfolio renumber failed")


def patch_portfolio_item(
    user: User,
    item_id: int,
    caption_raw: Any,
    category_raw: Any,
    work_date_raw: Any,
    *,
    patch_caption: bool = True,
    patch_category: bool = True,
    patch_work_date: bool = True,
) -> tuple[dict[str, Any], int]:
    if user.role != "technician":
        return {"success": False, "message": "هذه الميزة للفنيين فقط"}, 403
    tid = int(user.user_id)
    item = TechnicianPortfolioItem.query.filter_by(
        portfolio_item_id=item_id, technician_id=tid
    ).first()
    if item is None:
        return {"success": False, "message": "العنصر غير موجود"}, 404

    if patch_caption:
        caption, err = _sanitize_caption(caption_raw)
        if err:
            return {"success": False, "message": err}, 400
        item.caption = caption

    if patch_category:
        category, cerr = _sanitize_category(category_raw)
        if cerr:
            return {"success": False, "message": cerr}, 400
        item.category = category

    if patch_work_date:
        wd = _parse_work_date(work_date_raw)
        if wd == "bad_date":
            return {"success": False, "message": "تاريخ العمل غير صالح"}, 400
        item.work_date = wd
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ في قاعدة البيانات"}, 503

    return {
        "success": True,
        "limits": portfolio_limits_dict(),
        "item": serialize_portfolio_item_owner(item),
    }, 200


def reorder_portfolio_items(user: User, ordered_ids: Any) -> tuple[dict[str, Any], int]:
    if user.role != "technician":
        return {"success": False, "message": "هذه الميزة للفنيين فقط"}, 403
    if not isinstance(ordered_ids, list):
        return {"success": False, "message": "تنسيق الترتيب غير صالح"}, 400
    tid = int(user.user_id)
    ids: list[int] = []
    for x in ordered_ids:
        try:
            ids.append(int(x))
        except (TypeError, ValueError):
            return {"success": False, "message": "معرفات غير صالحة"}, 400

    existing = TechnicianPortfolioItem.query.filter_by(technician_id=tid).all()
    eids = {int(r.portfolio_item_id) for r in existing}
    if set(ids) != eids or len(ids) != len(eids):
        return {"success": False, "message": "قائمة الترتيب يجب أن تتضمن كل العناصر مرة واحدة"}, 400

    order_map = {pid: idx for idx, pid in enumerate(ids)}
    for r in existing:
        r.sort_order = order_map[int(r.portfolio_item_id)]
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ في قاعدة البيانات"}, 503

    rows = (
        TechnicianPortfolioItem.query.filter_by(technician_id=tid)
        .order_by(TechnicianPortfolioItem.sort_order.asc(), TechnicianPortfolioItem.portfolio_item_id.asc())
        .all()
    )
    return {
        "success": True,
        "limits": portfolio_limits_dict(),
        "items": [serialize_portfolio_item_owner(r) for r in rows],
    }, 200


def move_portfolio_item(user: User, item_id: int, direction: str) -> tuple[dict[str, Any], int]:
    if direction not in ("up", "down"):
        return {"success": False, "message": "اتجاه غير صالح"}, 400
    if user.role != "technician":
        return {"success": False, "message": "هذه الميزة للفنيين فقط"}, 403
    tid = int(user.user_id)
    rows = (
        TechnicianPortfolioItem.query.filter_by(technician_id=tid)
        .order_by(TechnicianPortfolioItem.sort_order.asc(), TechnicianPortfolioItem.portfolio_item_id.asc())
        .all()
    )
    idx = next((i for i, r in enumerate(rows) if int(r.portfolio_item_id) == int(item_id)), None)
    if idx is None:
        return {"success": False, "message": "العنصر غير موجود"}, 404
    j = idx - 1 if direction == "up" else idx + 1
    if j < 0 or j >= len(rows):
        return {"success": True, "limits": portfolio_limits_dict(), "items": [serialize_portfolio_item_owner(r) for r in rows]}, 200
    rows[idx].sort_order, rows[j].sort_order = rows[j].sort_order, rows[idx].sort_order
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return {"success": False, "message": "حدث خطأ في قاعدة البيانات"}, 503
    rows = (
        TechnicianPortfolioItem.query.filter_by(technician_id=tid)
        .order_by(TechnicianPortfolioItem.sort_order.asc(), TechnicianPortfolioItem.portfolio_item_id.asc())
        .all()
    )
    return {
        "success": True,
        "limits": portfolio_limits_dict(),
        "items": [serialize_portfolio_item_owner(r) for r in rows],
    }, 200


