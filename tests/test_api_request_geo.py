"""Tests for technician geo list filtering and location privacy serializers."""
from __future__ import annotations

import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace

from api_service_requests import (
    _detail_distance_km_for_viewer,
    api_can_view_request_coordinates,
    api_should_redact_location,
    count_open_pending_outside_radius,
    filter_technician_requests_by_geo,
    serialize_service_row,
)
from geo_utils import parse_detail_geo_query, parse_list_geo_query, round_distance_km


def _tech_user(user_id: int = 10, spec_id: int = 1) -> SimpleNamespace:
    return SimpleNamespace(user_id=user_id, role="technician", specialization_id=spec_id)


def _customer_user(user_id: int = 5) -> SimpleNamespace:
    return SimpleNamespace(user_id=user_id, role="customer", specialization_id=None)


def _admin_user() -> SimpleNamespace:
    return SimpleNamespace(user_id=99, role="admin", specialization_id=None)


def _request(
    request_id: int,
    *,
    status: str = "pending",
    technician_id: int | None = None,
    service_type: int = 1,
    lat: float | None = None,
    lng: float | None = None,
    city: str = "الرياض",
    district: str = "العليا",
    address: str = "شارع سري",
    created_at: datetime | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        request_id=request_id,
        customer_id=1,
        technician_id=technician_id,
        service_type=service_type,
        status=status,
        payment_status="pending",
        description="وصف تجريبي طويل بما يكفي",
        city=city,
        district=district,
        address=address,
        latitude=lat,
        longitude=lng,
        preferred_date=None,
        preferred_time=None,
        notes=None,
        created_at=created_at or datetime.utcnow(),
        completed_at=None,
        attachment_path=None,
        attachment_kind=None,
        service=None,
    )


class ParseListGeoQueryTests(unittest.TestCase):
    def test_omitted_returns_no_point(self):
        point, radius, sort_dist, err = parse_list_geo_query({})
        self.assertIsNone(point)
        self.assertEqual(radius, 50.0)
        self.assertFalse(sort_dist)
        self.assertIsNone(err)

    def test_valid_point_and_radius_cap(self):
        point, radius, sort_dist, err = parse_list_geo_query(
            {"lat": "24.7", "lng": "46.6", "radius_km": "500", "sort": "distance"}
        )
        self.assertEqual(point, (24.7, 46.6))
        self.assertEqual(radius, 200.0)
        self.assertTrue(sort_dist)
        self.assertIsNone(err)

    def test_partial_coords_rejected(self):
        _, _, _, err = parse_list_geo_query({"lat": "24.0"})
        self.assertIsNotNone(err)


class ParseDetailGeoQueryTests(unittest.TestCase):
    def test_omitted_returns_no_point(self):
        point, err = parse_detail_geo_query({})
        self.assertIsNone(point)
        self.assertIsNone(err)

    def test_valid_point(self):
        point, err = parse_detail_geo_query({"lat": "24.7", "lng": "46.6"})
        self.assertEqual(point, (24.7, 46.6))
        self.assertIsNone(err)

    def test_partial_coords_rejected(self):
        _, err = parse_detail_geo_query({"lat": "24.0"})
        self.assertIsNotNone(err)

    def test_ignores_radius_param(self):
        point, err = parse_detail_geo_query(
            {"lat": "24.7", "lng": "46.6", "radius_km": "not-a-number"}
        )
        self.assertEqual(point, (24.7, 46.6))
        self.assertIsNone(err)


class RequestDetailDistanceTests(unittest.TestCase):
    """Logic merged into detail JSON via serialize_service_row(distance_km=...)."""

    def test_technician_with_lat_lng_distance_matches_haversine(self):
        tech = _tech_user()
        sr = _request(
            1,
            status="pending",
            technician_id=None,
            lat=24.72,
            lng=46.68,
        )
        dist = _detail_distance_km_for_viewer(
            tech,
            sr,
            {"lat": str(24.7136), "lng": str(46.6753)},
        )
        self.assertIsNotNone(dist)
        self.assertAlmostEqual(dist, round_distance_km(0.8), delta=2.0)
        row = serialize_service_row(sr, viewer=tech, distance_km=dist)
        self.assertEqual(row["distance_km"], dist)

    def test_technician_without_lat_lng_has_no_distance_km(self):
        tech = _tech_user()
        sr = _request(2, lat=24.72, lng=46.68)
        dist = _detail_distance_km_for_viewer(tech, sr, None)
        self.assertIsNone(dist)
        row = serialize_service_row(sr, viewer=tech, distance_km=dist)
        self.assertNotIn("distance_km", row)

    def test_technician_without_request_coords_has_no_distance_km(self):
        tech = _tech_user()
        sr = _request(3, lat=None, lng=None)
        dist = _detail_distance_km_for_viewer(
            tech,
            sr,
            {"lat": "24.7136", "lng": "46.6753"},
        )
        self.assertIsNone(dist)

    def test_customer_viewer_never_gets_detail_distance_km(self):
        customer = _customer_user(user_id=1)
        sr = _request(4, lat=24.72, lng=46.68)
        dist = _detail_distance_km_for_viewer(
            customer,
            sr,
            {"lat": "24.7136", "lng": "46.6753"},
        )
        self.assertIsNone(dist)
        row = serialize_service_row(sr, viewer=customer, distance_km=dist)
        self.assertNotIn("distance_km", row)
        self.assertEqual(row["latitude"], 24.72)
        self.assertEqual(row["longitude"], 46.68)

    def test_redacted_technician_gets_distance_without_coords_in_row(self):
        """Detail JSON base: distance_km yes; lat/lng hidden via api_can_view_request_coordinates."""
        tech = _tech_user()
        sr = _request(
            5,
            status="pending",
            technician_id=None,
            lat=24.72,
            lng=46.68,
            address="عنوان سري",
        )
        dist = _detail_distance_km_for_viewer(
            tech,
            sr,
            {"lat": "24.7136", "lng": "46.6753"},
        )
        self.assertIsNotNone(dist)
        row = serialize_service_row(sr, viewer=tech, distance_km=dist)
        self.assertIn("distance_km", row)
        self.assertNotIn("latitude", row)
        self.assertNotIn("longitude", row)
        self.assertIsNone(row.get("address"))


class TechnicianGeoFilterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tech = _tech_user()
        self.tech_lat = 24.7136
        self.tech_lng = 46.6753

    def test_includes_assigned_job_outside_radius(self):
        assigned = _request(
            1,
            status="in_progress",
            technician_id=10,
            lat=21.4858,
            lng=39.1925,
        )
        rows, distances = filter_technician_requests_by_geo(
            [assigned],
            self.tech,
            self.tech_lat,
            self.tech_lng,
            50.0,
            sort_by_distance=True,
        )
        self.assertEqual([r.request_id for r in rows], [1])
        self.assertIn(1, distances)
        self.assertGreater(distances[1], 50.0)

    def test_includes_open_pending_without_coords_at_end(self):
        pending = _request(2, status="pending", technician_id=None, lat=None, lng=None)
        rows, distances = filter_technician_requests_by_geo(
            [pending],
            self.tech,
            self.tech_lat,
            self.tech_lng,
            50.0,
            sort_by_distance=True,
        )
        self.assertEqual([r.request_id for r in rows], [2])
        self.assertNotIn(2, distances)

    def test_pending_without_coords_after_in_radius_jobs(self):
        near = _request(
            7,
            status="pending",
            technician_id=None,
            lat=24.72,
            lng=46.68,
        )
        no_pin = _request(8, status="pending", technician_id=None, lat=None, lng=None)
        rows, distances = filter_technician_requests_by_geo(
            [no_pin, near],
            self.tech,
            self.tech_lat,
            self.tech_lng,
            50.0,
            sort_by_distance=True,
        )
        self.assertEqual([r.request_id for r in rows], [7, 8])
        self.assertIn(7, distances)
        self.assertNotIn(8, distances)

    def test_includes_open_pending_within_radius(self):
        near = _request(
            3,
            status="pending",
            technician_id=None,
            lat=24.72,
            lng=46.68,
        )
        rows, distances = filter_technician_requests_by_geo(
            [near],
            self.tech,
            self.tech_lat,
            self.tech_lng,
            50.0,
            sort_by_distance=True,
        )
        self.assertEqual([r.request_id for r in rows], [3])
        self.assertAlmostEqual(distances[3], round_distance_km(0.8), delta=2.0)

    def test_excludes_open_pending_outside_radius(self):
        far = _request(
            4,
            status="pending",
            technician_id=None,
            lat=21.4858,
            lng=39.1925,
        )
        rows, _ = filter_technician_requests_by_geo(
            [far],
            self.tech,
            self.tech_lat,
            self.tech_lng,
            50.0,
            sort_by_distance=True,
        )
        self.assertEqual(rows, [])

    def test_counts_open_pending_outside_radius(self):
        far = _request(
            4,
            status="pending",
            technician_id=None,
            lat=21.4858,
            lng=39.1925,
        )
        near = _request(
            3,
            status="pending",
            technician_id=None,
            lat=24.72,
            lng=46.68,
        )
        count = count_open_pending_outside_radius(
            [far, near],
            self.tech,
            self.tech_lat,
            self.tech_lng,
            50.0,
        )
        self.assertEqual(count, 1)

    def test_sort_by_distance_nearest_first(self):
        near = _request(
            5,
            status="pending",
            technician_id=None,
            lat=24.72,
            lng=46.68,
            created_at=datetime.utcnow(),
        )
        far_assigned = _request(
            6,
            status="assigned",
            technician_id=10,
            lat=21.4858,
            lng=39.1925,
            created_at=datetime.utcnow() - timedelta(days=1),
        )
        rows, _ = filter_technician_requests_by_geo(
            [far_assigned, near],
            self.tech,
            self.tech_lat,
            self.tech_lng,
            200.0,
            sort_by_distance=True,
        )
        self.assertEqual([r.request_id for r in rows], [5, 6])


class LocationPrivacyTests(unittest.TestCase):
    def test_redact_open_pending_for_technician(self):
        tech = _tech_user()
        sr = _request(1, status="pending", technician_id=None)
        self.assertTrue(api_should_redact_location(tech, sr))

    def test_no_redact_for_assigned_technician(self):
        tech = _tech_user()
        sr = _request(1, status="in_progress", technician_id=10)
        self.assertFalse(api_should_redact_location(tech, sr))

    def test_serializer_hides_address_and_coords_for_open_pending(self):
        tech = _tech_user()
        sr = _request(
            1,
            status="pending",
            technician_id=None,
            lat=24.7,
            lng=46.6,
            address="عنوان سري",
        )
        row = serialize_service_row(sr, viewer=tech, distance_km=3.2)
        self.assertIsNone(row["address"])
        self.assertNotIn("latitude", row)
        self.assertNotIn("longitude", row)
        self.assertEqual(row["city"], "الرياض")
        self.assertEqual(row["district"], "العليا")
        self.assertEqual(row["distance_km"], 3.2)

    def test_serializer_shows_address_and_coords_for_assigned_technician(self):
        tech = _tech_user()
        sr = _request(
            2,
            status="in_progress",
            technician_id=10,
            lat=24.7,
            lng=46.6,
            address="عنوان كامل",
        )
        row = serialize_service_row(sr, viewer=tech, distance_km=1.0)
        self.assertEqual(row["address"], "عنوان كامل")
        self.assertEqual(row["latitude"], 24.7)
        self.assertEqual(row["longitude"], 46.6)

    def test_customer_sees_coords_not_redacted(self):
        customer = _customer_user(user_id=1)
        sr = _request(3, status="pending", technician_id=None, lat=24.0, lng=46.0)
        self.assertFalse(api_should_redact_location(customer, sr))
        self.assertTrue(api_can_view_request_coordinates(customer, sr))
        row = serialize_service_row(sr, viewer=customer)
        self.assertEqual(row["address"], "شارع سري")
        self.assertEqual(row["latitude"], 24.0)

    def test_admin_sees_full_location(self):
        admin = _admin_user()
        sr = _request(4, lat=24.0, lng=46.0)
        row = serialize_service_row(sr, viewer=admin)
        self.assertTrue(api_can_view_request_coordinates(admin, sr))
        self.assertEqual(row["latitude"], 24.0)


if __name__ == "__main__":
    unittest.main()
