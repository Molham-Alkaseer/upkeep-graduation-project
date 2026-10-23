"""Create-request coordinate fields: mobile ↔ API ↔ customer_create_request."""
from __future__ import annotations

import unittest
from unittest import mock

from api_v1 import _create_request_payload_from_multipart
from app import app
from geo_utils import MAP_PIN_REQUIRED_MESSAGE, parse_optional_coordinates
from service_request_actions import customer_create_request

# Keys mobile apiCreateRequest sends (multipart + JSON body).
MOBILE_CREATE_GEO_KEYS = frozenset({"latitude", "longitude"})


class MultipartCreateGeoTests(unittest.TestCase):
    def test_multipart_payload_includes_mobile_geo_field_names(self):
        with app.test_request_context(
            method="POST",
            data={
                "service_type": "1",
                "description": "x" * 20,
                "city": "c",
                "district": "d",
                "address": "a",
                "preferred_date": "2099-01-01",
                "preferred_time": "morning",
                "latitude": "24.7136",
                "longitude": "46.6753",
            },
        ):
            payload = _create_request_payload_from_multipart()
        self.assertTrue(MOBILE_CREATE_GEO_KEYS <= set(payload.keys()))
        self.assertEqual(payload["latitude"], "24.7136")
        self.assertEqual(payload["longitude"], "46.6753")

    def test_parse_optional_coordinates_from_multipart_shape(self):
        lat, lon, err = parse_optional_coordinates(
            {"latitude": "24.7136", "longitude": "46.6753"}
        )
        self.assertIsNone(err)
        self.assertAlmostEqual(lat or 0, 24.7136)
        self.assertAlmostEqual(lon or 0, 46.6753)

    def test_missing_coordinates_rejected(self):
        customer = mock.MagicMock()
        customer.role = "customer"
        customer.user_id = 1
        body, code = customer_create_request(
            customer,
            {
                "service_type": "1",
                "description": "x" * 20,
                "city": "c",
                "district": "d",
                "address": "a",
                "preferred_date": "2099-01-01",
                "preferred_time": "morning",
            },
        )
        self.assertEqual(code, 400)
        self.assertFalse(body.get("success"))
        self.assertEqual(body.get("message"), MAP_PIN_REQUIRED_MESSAGE)


if __name__ == "__main__":
    unittest.main()
