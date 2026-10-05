"""Guard the legacy compiler's write boundary, including real current composition."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("builder", Path(__file__).with_name("build_streaming_bridge.py"))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class LegacyInputTests(unittest.TestCase):
    def fixture(self, ids):
        return {"schema":"gridatlas.current.v2", "cartridge_order":ids,
                "cartridges":[{"id":value} for value in ids]}

    def test_original_input_is_accepted(self):
        builder.assert_legacy_input(self.fixture([builder.SEARCH_ID]))

    def test_original_completed_input_is_accepted(self):
        builder.assert_legacy_input(self.fixture([builder.TRANSPORT_ID,builder.SEARCH_ID]))

    def test_extra_cartridge_is_not_discarded(self):
        for extra in ["substation-intelligence", "sld-sandbox", "future-plugin"]:
            with self.subTest(extra=extra), self.assertRaisesRegex(RuntimeError,"refuses"):
                builder.assert_legacy_input(self.fixture([builder.SEARCH_ID,extra]))

    def test_hidden_unordered_cartridge_is_rejected(self):
        value=self.fixture([builder.SEARCH_ID]);value["cartridges"].append({"id":"future-plugin"})
        with self.assertRaisesRegex(RuntimeError,"disagree"):builder.assert_legacy_input(value)

    def test_duplicate_registry_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError,"duplicate"):
            builder.assert_legacy_input(self.fixture([builder.SEARCH_ID,builder.SEARCH_ID]))

    def test_current_composition_refuses_before_any_write(self):
        current=json.loads(builder.CURRENT.read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/"atlas").mkdir()
            path=root/"atlas/current.json";path.write_text(json.dumps(current))
            (root/"request.json").write_text(json.dumps({"schema":"gridatlas.streaming-road-fix-request.v1","composition_version":"v9.5"}))
            before={str(p.relative_to(root)):p.read_bytes() for p in root.rglob("*") if p.is_file()}
            with patch.object(builder,"ROOT",root),patch.object(builder,"CURRENT",path),patch("sys.argv",["builder","--generation","202609060055","--request","request.json"]):
                with self.assertRaisesRegex(RuntimeError,"refuses"):builder.main()
            after={str(p.relative_to(root)):p.read_bytes() for p in root.rglob("*") if p.is_file()}
            self.assertEqual(before,after)

if __name__ == "__main__":unittest.main()
