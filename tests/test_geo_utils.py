"""Unit tests for geo_utils (haversine + coordinate validation)."""
from __future__ import annotations

import unittest

from geo_utils import (
    haversine_km,
    is_valid_latitude,
    is_valid_longitude,
    parse_list_geo_query,
    parse_optional_coordinates,
)


class HaversineTests(unittest.TestCase):
    def test_same_point_is_zero(self):
        self.assertAlmostEqual(haversine_km(24.7136, 46.6753, 24.7136, 46.6753), 0.0, places=5)

    def test_riyadh_to_jeddah_approximate(self):
        # Demo seed coords: ~844 km great-circle distance
        km = haversine_km(24.7136, 46.6753, 21.4858, 39.1925)
        self.assertGreater(km, 800.0)
        self.assertLess(km, 900.0)


class CoordinateValidationTests(unittest.TestCase):
    def test_omitted_coordinates(self):
        lat, lon, err = parse_optional_coordinates({})
        self.assertIsNone(lat)
        self.assertIsNone(lon)
        self.assertIsNone(err)

    def test_empty_strings_treated_as_omitted(self):
        lat, lon, err = parse_optional_coordinates({"latitude": "", "longitude": ""})
        self.assertIsNone(lat)
        self.assertIsNone(lon)
        self.assertIsNone(err)

    def test_valid_pair(self):
        lat, lon, err = parse_optional_coordinates({"latitude": "24.7", "longitude": "46.6"})
        self.assertAlmostEqual(lat, 24.7)
        self.assertAlmostEqual(lon, 46.6)
        self.assertIsNone(err)

    def test_partial_pair_rejected(self):
        _, _, err = parse_optional_coordinates({"latitude": "24.0"})
        self.assertIsNotNone(err)

    def test_invalid_latitude_range(self):
        _, _, err = parse_optional_coordinates({"latitude": "91", "longitude": "0"})
        self.assertIsNotNone(err)

    def test_invalid_longitude_range(self):
        _, _, err = parse_optional_coordinates({"latitude": "0", "longitude": "181"})
        self.assertIsNotNone(err)

    def test_non_numeric_rejected(self):
        _, _, err = parse_optional_coordinates({"latitude": "abc", "longitude": "1"})
        self.assertIsNotNone(err)

    def test_boundary_validators(self):
        self.assertTrue(is_valid_latitude(90.0))
        self.assertTrue(is_valid_latitude(-90.0))
        self.assertFalse(is_valid_latitude(90.1))
        self.assertTrue(is_valid_longitude(180.0))
        self.assertTrue(is_valid_longitude(-180.0))
        self.assertFalse(is_valid_longitude(180.1))


class ParseListGeoQueryTests(unittest.TestCase):
    def test_default_radius_when_geo_active(self):
        point, radius, _, err = parse_list_geo_query({"lat": "1", "lng": "2"})
        self.assertEqual(point, (1.0, 2.0))
        self.assertEqual(radius, 50.0)
        self.assertIsNone(err)


if __name__ == "__main__":
    unittest.main()
