"""Shared limits for technician work portfolio (API + web). Keep in sync with `mobile/src/portfolioLimits.ts`."""

from __future__ import annotations

import os

# Max items per technician profile
PORTFOLIO_MAX_ITEMS = int(os.getenv("PORTFOLIO_MAX_ITEMS", "24"))

# Primary image upload (full-size stored; grid uses same URL for Phase 1 — no separate thumb pipeline)
PORTFOLIO_MAX_IMAGE_BYTES = int(os.getenv("PORTFOLIO_MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))

PORTFOLIO_CAPTION_MAX_LEN = int(os.getenv("PORTFOLIO_CAPTION_MAX_LEN", "280"))
PORTFOLIO_CATEGORY_MAX_LEN = int(os.getenv("PORTFOLIO_CATEGORY_MAX_LEN", "60"))

PORTFOLIO_ALLOWED_IMAGE_EXTENSIONS = frozenset({"png", "jpg", "jpeg", "webp", "gif"})

# Phase 1: images only (reserved for later video support)
PORTFOLIO_MAX_VIDEOS = int(os.getenv("PORTFOLIO_MAX_VIDEOS", "0"))
PORTFOLIO_MAX_VIDEO_BYTES = int(os.getenv("PORTFOLIO_MAX_VIDEO_BYTES", str(50 * 1024 * 1024)))
PORTFOLIO_MAX_VIDEO_DURATION_SEC = int(os.getenv("PORTFOLIO_MAX_VIDEO_DURATION_SEC", "120"))

PORTFOLIO_UPLOAD_SUBDIR = "uploads/portfolio"


def portfolio_limits_dict() -> dict[str, int]:
    return {
        "max_items": PORTFOLIO_MAX_ITEMS,
        "max_image_bytes": PORTFOLIO_MAX_IMAGE_BYTES,
        "caption_max_len": PORTFOLIO_CAPTION_MAX_LEN,
        "category_max_len": PORTFOLIO_CATEGORY_MAX_LEN,
        "max_videos": PORTFOLIO_MAX_VIDEOS,
        "max_video_bytes": PORTFOLIO_MAX_VIDEO_BYTES,
        "max_video_duration_sec": PORTFOLIO_MAX_VIDEO_DURATION_SEC,
    }


def allowed_portfolio_image(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in PORTFOLIO_ALLOWED_IMAGE_EXTENSIONS
