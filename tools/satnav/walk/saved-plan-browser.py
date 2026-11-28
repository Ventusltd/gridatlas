"""Start the same walk from map taps, the device's saved plan and a native file import."""

import json
import math
import os
import re
from pathlib import Path
from runpy import run_path

from playwright.sync_api import expect, sync_playwright


helpers = run_path(str(Path(__file__).resolve().parents[1] / "waypoint-browser.py"))
SITE = os.environ.get("LINE_TEST_URL", "http://127.0.0.1:8873/atlas/v/satnav-walk-202611281340/")
SURVEY = "document.querySelector('#satnav-compact').satnavSurvey"


def open_map(page):
    page.goto(SITE, wait_until="domcontentloaded")
    page.wait_for_function("!!window.__GRIDATLAS_V9_MAP__?.getLayer('l-sat')", timeout=60000)
    expect(page.locator("#satnav-walk-start")).to_be_visible(timeout=30000)
    page.wait_for_function(SURVEY + ".getMap() === window.__GRIDATLAS_V9_MAP__")


def disclosure(page, name):
    summary = page.locator("summary").filter(has_text=re.compile(rf"^{re.escape(name)}$"))
    area = summary.locator("..")
    if not area.evaluate("el => el.open"):
        summary.tap()
    return area


def direct(page, metres, bearing):
    distances = "|".join(str(i) for i in range(metres - 2, metres + 3))
    bearings = "|".join(str(i % 360) for i in range(bearing - 2, bearing + 3))
    expect(page.locator("#satnav-walk-guidance")).to_have_text(
        re.compile(rf"Direct to pin · (?:{distances}) m · (?:{bearings})° true")
    )


def feature(kind, coordinates, role, **properties):
    return {"type": "Feature", "geometry": {"type": kind, "coordinates": coordinates},
            "properties": {"satnavRole": role, **properties}}


def check_browser(browser, name, width, height):
    with browser.new_context(viewport={"width": width, "height": height}, is_mobile=True, has_touch=True) as context:
        context.add_init_script(helpers["GPS_SPY"])
        page = context.new_page()
        open_map(page)
        page.evaluate("window.__GRIDATLAS_V9_MAP__.jumpTo({center:[-1.5,51.5],zoom:17}); void 0")
        helpers["place"](page, "from", 16)
        helpers["pins"](page, 1)
        helpers["place"](page, "to", 9)
        helpers["pins"](page, 2)
        plan = page.evaluate(SURVEY + ".getEndpoints()")
        start, end = plan
        south = [end[0], end[1] - 63 / 111195]
        start_button = page.get_by_role("button", name="Start walk", exact=True)
        stop_button = page.get_by_role("button", name="Stop walk", exact=True)
        start_button.tap()
        helpers["emit_fix"](page, south, accuracy=4)
        direct(page, 63, 0)

        offline = disclosure(page, "Offline plan")
        offline.get_by_role("button", name="Save plan", exact=True).tap()
        expect(offline.get_by_role("status")).to_contain_text("Saved.", timeout=25000)
        assert page.evaluate(SURVEY + ".getEndpoints()") == plan
        stop_button.tap()
        assert page.evaluate("window.__lineGpsTest.records") == {"starts": [1], "stops": [1]}

        # Reopen the same address in this device context, with no in-memory plan.
        page.close()
        page = context.new_page()
        open_map(page)
        assert page.evaluate(SURVEY + ".getEndpoints()") == [None, None]
        start_button = page.get_by_role("button", name="Start walk", exact=True)
        stop_button = page.get_by_role("button", name="Stop walk", exact=True)
        offline = disclosure(page, "Offline plan")
        restore = offline.get_by_role("button", name="Use saved plan")
        restore.tap()
        expect(offline.get_by_role("status")).to_contain_text("Saved plan loaded · 2 pins")
        assert page.evaluate(SURVEY + ".getEndpoints()") == plan
        assert page.evaluate("window.__lineGpsTest.records.starts") == []
        start_button.tap()
        helpers["emit_fix"](page, south, accuracy=4)
        direct(page, 63, 0)
        helpers["emit_fix"](page, end, accuracy=4)
        expect(page.locator("#satnav-walk-guidance")).to_contain_text("Arrived")

        east = [end[0] + 100 / (111195 * math.cos(math.radians(end[1]))), end[1]]
        record = [east[0] + .002, east[1] + .002]
        data = {"type": "FeatureCollection", "features": [
            feature("LineString", [start, east], "planned-route", name="Design walk"),
            feature("Point", record, "walked-fix", accuracyM=4, timestampMs=1000),
            feature("LineString", [south, record], "walked-track", accuracyM=[4, 4], timestampMs=[2000, 3000]),
        ]}
        layout = disclosure(page, "Layouts")
        with page.expect_file_chooser() as picker:
            layout.get_by_role("button", name="Import layout").tap()
        picker.value.set_files({"name": "walk.geojson", "mimeType": "application/geo+json",
                                "buffer": json.dumps(data).encode()})
        expect(layout.get_by_role("status")).to_contain_text("1 design · 2 recorded")
        expect(layout.get_by_role("combobox").locator("option")).to_have_text(["Design walk"])
        assert page.evaluate(SURVEY + ".getEndpoints()") == plan
        helpers["emit_fix"](page, end, accuracy=4)
        expect(page.locator("#satnav-walk-guidance")).to_contain_text("Arrived")
        layout.get_by_role("button", name="Use for walk").tap()
        assert page.evaluate(SURVEY + ".getEndpoints()") == [start, east]
        direct(page, 100, 90)
        helpers["measured"](page, end)
        assert page.evaluate("window.__lineGpsTest.records") == {"starts": [1], "stops": []}

        stop_button.tap()
        start_button.tap()
        helpers["emit_fix"](page, end, accuracy=4)
        direct(page, 100, 90)
        restore.tap()
        expect(page.locator("#satnav-walk-guidance")).to_contain_text("Arrived")
        assert page.evaluate(SURVEY + ".getEndpoints()") == plan
        helpers["measured"](page, end)
        offline.get_by_role("button", name="Forget saved plan").tap()
        expect(offline.get_by_role("status")).to_contain_text("removed")
        restore.tap()
        expect(offline.get_by_role("status")).to_contain_text("No saved plan")
        assert page.evaluate(SURVEY + ".getEndpoints()") == plan
        stop_button.tap()
        assert page.evaluate("window.__lineGpsTest.records") == {"starts": [1, 2], "stops": [1, 2]}
        print(f"{name} {width}×{height}: hand-placed, restored and imported starts passed; "
              "old arrival replaced by 100 m east; recorded features excluded; all watches cleared.", flush=True)


if __name__ == "__main__":
    with sync_playwright() as driver:
        for engine in os.environ.get("LINE_TEST_BROWSERS", "chromium,webkit").split(","):
            engine = engine.strip()
            options = {"args": ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader",
                                "--enable-unsafe-swiftshader"]} if engine == "chromium" else {}
            with getattr(driver, engine).launch(**options) as browser:
                for size in [(390, 664), (664, 390)]:
                    check_browser(browser, engine, *size)
