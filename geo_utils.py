"""Geographic helpers for service-request location (hybrid city + coordinates)."""
from __future__ import annotations

import math
from typing import Any

# Shared with web/mobile create-request validation (Arabic UX copy).
MAP_PIN_REQUIRED_MESSAGE = "يرجى تحديد موقع الخدمة على الخريطة"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometers between two WGS84 points."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def is_valid_latitude(lat: float) -> bool:
    return -90.0 <= lat <= 90.0


def is_valid_longitude(lon: float) -> bool:
    return -180.0 <= lon <= 180.0


def _optional_coordinate_value(value: Any) -> float | None | str:
    """Return float, None if omitted, or 'invalid' if present but not parseable."""
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return "invalid"


def parse_optional_coordinates(
    data: dict[str, Any],
) -> tuple[float | None, float | None, str | None]:
    """
    Read optional latitude/longitude from a request payload.

    Returns (latitude, longitude, error_message). When coords are omitted, both are None.
    """
    lat = _optional_coordinate_value(data.get("latitude"))
    if lat == "invalid":
        return None, None, "إحداثيات غير صالحة"
    lon = _optional_coordinate_value(data.get("longitude"))
    if lon == "invalid":
        return None, None, "إحداثيات غير صالحة"

    if lat is None and lon is None:
        return None, None, None
    if lat is None or lon is None:
        return None, None, "يجب إرسال خط العرض وخط الطول معاً"
    if not is_valid_latitude(lat):
        return None, None, "خط العرض يجب أن يكون بين -90 و 90"
    if not is_valid_longitude(lon):
        return None, None, "خط الطول يجب أن يكون بين -180 و 180"
    return lat, lon, None


def parse_list_geo_query(
    args: dict[str, Any],
) -> tuple[tuple[float, float] | None, float, bool, str | None]:
    """
    Parse GET /requests geo query params.

    Returns (tech_point or None, radius_km, sort_by_distance, error_message).
    tech_point is (lat, lng) when both lat and lng are provided.
    """
    lat = _optional_coordinate_value(args.get("lat"))
    if lat == "invalid":
        return None, 50.0, False, "إحداثيات غير صالحة"
    lng = _optional_coordinate_value(args.get("lng"))
    if lng == "invalid":
        return None, 50.0, False, "إحداثيات غير صالحة"

    if lat is None and lng is None:
        return None, 50.0, False, None
    if lat is None or lng is None:
        return None, 50.0, False, "يجب إرسال lat و lng معاً"
    if not is_valid_latitude(lat):
        return None, 50.0, False, "خط العرض يجب أن يكون بين -90 و 90"
    if not is_valid_longitude(lng):
        return None, 50.0, False, "خط الطول يجب أن يكون بين -180 و 180"

    raw_radius = args.get("radius_km")
    radius_km = 50.0
    if raw_radius is not None and str(raw_radius).strip() != "":
        try:
            radius_km = float(raw_radius)
        except (TypeError, ValueError):
            return None, 50.0, False, "نطاق البحث غير صالح"
        if radius_km <= 0:
            return None, 50.0, False, "نطاق البحث غير صالح"
        if radius_km > 200.0:
            radius_km = 200.0

    sort_raw = str(args.get("sort") or "").strip().lower()
    sort_by_distance = sort_raw in ("", "distance")

    return (lat, lng), radius_km, sort_by_distance, None


def parse_detail_geo_query(
    args: dict[str, Any],
) -> tuple[tuple[float, float] | None, str | None]:
    """
    Parse GET /requests/<id> geo query params (lat/lng only).

    Returns (tech_point or None, error_message).
    """
    lat = _optional_coordinate_value(args.get("lat"))
    if lat == "invalid":
        return None, "إحداثيات غير صالحة"
    lng = _optional_coordinate_value(args.get("lng"))
    if lng == "invalid":
        return None, "إحداثيات غير صالحة"

    if lat is None and lng is None:
        return None, None
    if lat is None or lng is None:
        return None, "يجب إرسال lat و lng معاً"
    if not is_valid_latitude(lat):
        return None, "خط العرض يجب أن يكون بين -90 و 90"
    if not is_valid_longitude(lng):
        return None, "خط الطول يجب أن يكون بين -180 و 180"

    return (lat, lng), None


def round_distance_km(distance_km: float) -> float:
    return round(float(distance_km), 1)
