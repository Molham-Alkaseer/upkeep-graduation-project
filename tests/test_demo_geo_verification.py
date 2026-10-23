"""Integration checks for demo seed + technician geo list (local dev)."""
from __future__ import annotations

import unittest

from app import app, db
from api_service_requests import (
    api_should_redact_location,
    build_request_detail_payload,
    filter_technician_requests_by_geo,
    query_requests_for_api_user,
    serialize_service_row,
)
from models import ServiceRequest, User
from geo_utils import parse_optional_coordinates


class DemoGeoVerificationTests(unittest.TestCase):
    """Run against local MySQL with seed_demo data when available."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.app = app
        cls.ctx = cls.app.app_context()
        cls.ctx.push()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.ctx.pop()

    def test_parse_coordinates_validation(self) -> None:
        lat, lon, err = parse_optional_coordinates({"latitude": "24.7", "longitude": "46.6"})
        self.assertIsNone(err)
        self.assertAlmostEqual(lat or 0, 24.7)
        self.assertAlmostEqual(lon or 0, 46.6)

    def test_demo_technician_geo_filter_damascus(self) -> None:
        tech = User.query.filter_by(email="tech.ahmad@upkeep.local").first()
        if tech is None:
            self.skipTest("Run seed_demo.py first")
        q = query_requests_for_api_user(tech, None)
        assert q is not None
        rows = q.all()
        filtered, distances = filter_technician_requests_by_geo(
            rows, tech, 33.5008, 36.2526, 50.0, sort_by_distance=True
        )
        pending_damascus = [
            r
            for r in filtered
            if r.status == "pending"
            and r.technician_id is None
            and r.latitude is not None
        ]
        self.assertTrue(
            any(abs(r.latitude - 33.5008) < 0.1 for r in pending_damascus),
            "expected seeded Damascus pending job within geo filter",
        )
        assigned_mine = [r for r in filtered if r.technician_id == tech.user_id]
        self.assertGreaterEqual(len(assigned_mine), 1, "assigned demo job should always appear")

    def test_demo_privacy_pending_detail(self) -> None:
        tech = User.query.filter_by(email="tech.ahmad@upkeep.local").first()
        pending = (
            ServiceRequest.query.filter_by(status="pending", technician_id=None)
            .filter(ServiceRequest.latitude.isnot(None))
            .first()
        )
        if tech is None or pending is None:
            self.skipTest("Run seed_demo.py first")
        self.assertTrue(api_should_redact_location(tech, pending))
        row = serialize_service_row(pending, viewer=tech)
        self.assertIsNone(row.get("address"))
        self.assertNotIn("latitude", row)
        detail = build_request_detail_payload(
            tech, pending, {"lat": "33.5008", "lng": "36.2526"}
        )
        self.assertIsNone(detail.get("address"))
        self.assertNotIn("latitude", detail)
        self.assertNotIn("longitude", detail)
        self.assertIn("distance_km", detail)


if __name__ == "__main__":
    unittest.main()
