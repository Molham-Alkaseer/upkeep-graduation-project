"""Server-side translations for Jinja templates (synced with locales/*/common.json)."""

from __future__ import annotations

import json
import os
from typing import Any, Callable, Dict, Optional

from flask import Flask, request

from timeline_messages import format_timeline_line

_WEB_CACHE: Dict[str, Dict[str, Any]] = {}
"""mtime (seconds) of locales/<lang>/common.json last loaded — avoids stale strings after JSON edits."""
_BUNDLE_MTIME: Dict[str, float] = {}


def _deep_get(data: Dict[str, Any], key: str) -> Any:
    cur: Any = data
    for part in key.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def _interpolate(s: str, kwargs: Dict[str, Any]) -> str:
    out = s
    for k, v in kwargs.items():
        out = out.replace("{{" + k + "}}", str(v))
    return out


def load_common_bundle(root_path: str, lang: str) -> Dict[str, Any]:
    path = os.path.join(root_path, "locales", lang, "common.json")
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        mtime = 0.0
    if lang not in _WEB_CACHE or _BUNDLE_MTIME.get(lang) != mtime:
        with open(path, encoding="utf-8") as f:
            _WEB_CACHE[lang] = json.load(f)
        _BUNDLE_MTIME[lang] = mtime
    return _WEB_CACHE[lang]


def translate_bundle(bundle: Dict[str, Any], key: str, **kwargs: Any) -> str:
    val = _deep_get(bundle, key)
    if val is None:
        return key
    if not isinstance(val, str):
        return str(val)
    return _interpolate(val, kwargs) if kwargs else val


def service_display_name(service: Any, lang: str) -> str:
    if service is None:
        return ""
    name_ar = getattr(service, "name_ar", None) or ""
    name_en = getattr(service, "name_en", None) or ""
    if lang == "en":
        return name_en or name_ar
    return name_ar or name_en


def locale_split_full_name(combined: str, lang: str) -> str:
    """Pick Arabic vs English side from legacy `full_name` stored as 'ar / en' or 'ar/en'."""
    s = (combined or "").strip()
    if not s:
        return ""
    if "/" not in s:
        return s
    left, _, right = s.partition("/")
    ar, en = left.strip(), right.strip()
    if lang == "en":
        return en or ar
    return ar or en


def locale_user_display_name(obj: Any, lang: str) -> str:
    """
    Person name for the active locale (matches mobile `userLocaleDisplayName`).
    Accepts User-like objects, dicts (e.g. API / public profile), or legacy `full_name` 'ar / en'.
    """
    if obj is None:
        return ""

    def from_ar_en(ar: str, en: str) -> str:
        a = (ar or "").strip()
        e = (en or "").strip()
        if lang == "en":
            return e or a
        return a or e

    if isinstance(obj, dict):
        return from_ar_en(
            str(obj.get("full_name_ar") or ""),
            str(obj.get("full_name_en") or ""),
        )

    ar = (getattr(obj, "full_name_ar", None) or "").strip()
    en = (getattr(obj, "full_name_en", None) or "").strip()
    if ar or en:
        return from_ar_en(ar, en)

    legacy = (getattr(obj, "full_name", None) or "").strip()
    if legacy:
        return locale_split_full_name(legacy, lang)

    return ""


def init_web_i18n(app: Flask, get_i18n_constants: Callable[[], Dict[str, Any]]) -> None:
    @app.context_processor
    def inject_web_i18n() -> Dict[str, Any]:
        const = get_i18n_constants()
        sk = str(const.get("STORAGE_KEY", "upkeep.locale"))
        raw: Optional[str] = request.cookies.get(sk)
        lang = raw if raw in ("en", "ar") else str(const.get("DEFAULT_LANGUAGE", "en"))
        bundle = load_common_bundle(app.root_path, lang)

        def t(key: str, **kwargs: Any) -> str:
            return translate_bundle(bundle, key, **kwargs)

        def service_label(svc: Any) -> str:
            return service_display_name(svc, lang)

        def timeline_entry_text(entry: Any) -> str:
            return format_timeline_line(entry, lang, t)

        def user_label(u: Any) -> str:
            if isinstance(u, str):
                return locale_split_full_name(u, lang)
            return locale_user_display_name(u, lang)

        return {
            "locale": lang,
            "t": t,
            "service_label": service_label,
            "timeline_entry_text": timeline_entry_text,
            "user_label": user_label,
        }
