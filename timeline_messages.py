"""
Structured request timeline notes for locale-aware display.

Stores compact JSON in RequestTimeline.note (v=2). Legacy rows may be Arabic plain text;
those are pattern-matched and re-rendered with t() + user_locale_name.
"""

from __future__ import annotations

import json
import re
from decimal import Decimal
from typing import Any, Callable, Optional, Tuple

from models import RequestTimeline, User

TranslateFn = Callable[..., str]


def user_locale_name(user: Optional[User], locale: str) -> str:
    """Prefer full_name_en / full_name_ar; fall back to legacy full_name 'ar/en' split."""
    if user is None:
        return ""
    if locale == "en":
        en = (getattr(user, "full_name_en", None) or "").strip()
        if en:
            return en
        parts = (user.full_name or "").split("/")
        if len(parts) >= 2 and parts[1].strip():
            return parts[1].strip()
        return (user.full_name or "").strip()
    ar = (getattr(user, "full_name_ar", None) or "").strip()
    if ar:
        return ar
    parts = (user.full_name or "").split("/")
    if parts and parts[0].strip():
        return parts[0].strip()
    return (user.full_name or "").strip()


def encode_timeline(kind: str, **payload: Any) -> str:
    """Serialize timeline event for RequestTimeline.note (max ~255 chars)."""
    data: dict[str, Any] = {"v": 2, "k": kind}
    for key, val in payload.items():
        if val is not None:
            data[key] = val
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    if len(raw) <= 255:
        return raw
    minimal = {"v": 2, "k": kind}
    if "a" in data:
        minimal["a"] = data["a"]
    return json.dumps(minimal, ensure_ascii=False, separators=(",", ":"))


def parse_timeline_note(note: Optional[str]) -> Tuple[bool, dict[str, Any]]:
    if not note or not str(note).strip():
        return False, {}
    s = str(note).strip()
    if not s.startswith("{"):
        return False, {}
    try:
        d = json.loads(s)
    except json.JSONDecodeError:
        return False, {}
    if not isinstance(d, dict) or d.get("v") != 2:
        return False, {}
    return True, d


def _resolve_actor(entry: RequestTimeline, aid_from_payload: Any) -> Optional[User]:
    actor = getattr(entry, "actor", None)
    if actor is not None:
        return actor
    if aid_from_payload is not None:
        return User.query.get(int(aid_from_payload))
    if entry.actor_id is not None:
        return User.query.get(int(entry.actor_id))
    return None


def _format_v2_event(
    entry: RequestTimeline,
    data: dict[str, Any],
    locale: str,
    t: TranslateFn,
    cur: str,
) -> str:
    kind = data.get("k")
    aid = data.get("a")
    actor = _resolve_actor(entry, aid)
    name = user_locale_name(actor, locale)

    if kind == "created_by_customer":
        return t("web.timeline.createdByCustomer")

    if kind == "offer_sent":
        if not name and aid is not None:
            name = t("web.trackRequest.technicianFallback", id=aid)
        return t("web.timeline.offerSent", name=name)

    if kind == "offer_chosen":
        amt = data.get("m", "")
        return t("web.timeline.offerChosen", amount=str(amt), currency=cur)

    if kind == "work_started":
        amt = data.get("m", "")
        return t("web.timeline.workStarted", amount=str(amt), currency=cur)

    if kind == "work_completed":
        return t("web.timeline.workCompleted")

    if kind == "payment_done":
        amt = data.get("m", "")
        return t("web.timeline.paymentDone", amount=str(amt), currency=cur)

    if kind == "rating_added":
        stars = data.get("s", "")
        return t("web.timeline.ratingAdded", stars=str(stars))

    if entry.note:
        return str(entry.note)
    return t(f"web.status.request.{entry.status}")


def try_legacy_plain_ar_note(
    entry: RequestTimeline,
    locale: str,
    t: TranslateFn,
    cur: str,
) -> Optional[str]:
    """
    Older DB rows store Arabic sentences (no JSON). Map them to the same templates as v2.
    Uses entry.actor_id / relationship for locale-correct names when possible.
    """
    raw = (entry.note or "").strip()
    if not raw or raw.startswith("{"):
        return None

    actor = _resolve_actor(entry, None)

    if raw == "تم إنشاء الطلب من قبل العميل":
        return t("web.timeline.createdByCustomer")

    if raw == "تم إكمال العمل من قبل الفني":
        return t("web.timeline.workCompleted")

    m = re.match(r"تم إرسال/تحديث عرض من الفني\s+(.+)", raw)
    if m:
        name = user_locale_name(actor, locale) if actor else m.group(1).strip()
        if not name and entry.actor_id is not None:
            name = t("web.trackRequest.technicianFallback", id=entry.actor_id)
        return t("web.timeline.offerSent", name=name)

    m = re.search(r"اختار العميل عرض الفني بمبلغ\s*([\d.]+)\s*ل\.س", raw)
    if m:
        return t("web.timeline.offerChosen", amount=m.group(1), currency=cur)

    m = re.search(
        r"بدأ الفني تنفيذ الطلب\s*\(\s*المبلغ المتفق عليه:\s*([\d.]+)\s*ل\.س\s*\)",
        raw,
    )
    if m:
        return t("web.timeline.workStarted", amount=m.group(1), currency=cur)

    m = re.search(r"تم الدفع بنجاح بقيمة\s*([\d.]+)\s*ل\.س", raw)
    if m and "فاتورة" in raw:
        return t("web.timeline.paymentDone", amount=m.group(1), currency=cur)

    m = re.search(r"أضاف العميل تقييماً للفني\s*\((\d+)/5\)", raw)
    if m:
        return t("web.timeline.ratingAdded", stars=m.group(1))

    return None


def format_timeline_line(entry: RequestTimeline, locale: str, t: TranslateFn) -> str:
    """Resolve timeline row text for the active web locale."""
    cur = t("web.currencySuffix")
    ok, data = parse_timeline_note(entry.note)

    try:
        if ok:
            return _format_v2_event(entry, data, locale, t, cur)

        legacy = try_legacy_plain_ar_note(entry, locale, t, cur)
        if legacy is not None:
            return legacy

        if entry.note:
            return str(entry.note)
        return t(f"web.status.request.{entry.status}")
    except Exception:
        if entry.note:
            return str(entry.note)
        return t(f"web.status.request.{entry.status}")


def money_str(v: Any) -> str:
    try:
        return str(Decimal(str(v)).quantize(Decimal("0.01")))
    except Exception:
        return str(v)
