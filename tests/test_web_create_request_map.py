"""Web create-request map pin: template contract + coordinate parsing."""
from __future__ import annotations

import re
import unittest
from pathlib import Path

from geo_utils import parse_optional_coordinates

TEMPLATE = Path(__file__).resolve().parents[1] / "templates" / "create_request.html"


class CreateRequestMapTemplateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.html = TEMPLATE.read_text(encoding="utf-8")

    def test_requires_explicit_pin_confirmation(self) -> None:
        self.assertIn("pinConfirmed", self.html)

    def test_geo_status_uses_i18n_keys_not_coordinates(self) -> None:
        self.assertIn("setGeoStatus('locationSetOk')", self.html)
        self.assertNotRegex(
            self.html,
            re.compile(r"setGeoStatus\s*\(\s*[^'\"]*\d"),
        )
        self.assertNotIn("toFixed", self.html)

    def test_leaflet_marker_icon_cdn_fix(self) -> None:
        self.assertIn("iconUrl", self.html)
        self.assertIn("marker-icon.png", self.html)

    def test_default_marker_placed_on_load(self) -> None:
        self.assertIn("ensureMarker(defaultLatLng)", self.html)

    def test_submit_validates_pin_and_ranges(self) -> None:
        self.assertIn("mapPinRequired", self.html)
        self.assertIn("mapPinInvalid", self.html)
        self.assertIn("isValidCoordPair", self.html)


class CreateRequestFormCoordTests(unittest.TestCase):
    def test_hidden_field_values_parse_like_api(self) -> None:
        lat, lon, err = parse_optional_coordinates(
            {"latitude": "24.7136", "longitude": "46.6753"}
        )
        self.assertIsNone(err)
        self.assertAlmostEqual(lat or 0, 24.7136)
        self.assertAlmostEqual(lon or 0, 46.6753)

    def test_out_of_range_rejected(self) -> None:
        _, _, err = parse_optional_coordinates({"latitude": "95", "longitude": "46"})
        self.assertIsNotNone(err)


if __name__ == "__main__":
    unittest.main()
