"""Exercise local layout import, edit, export and failure recovery on the V4 map."""

import json
import os
import runpy
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


SATNAV = Path(__file__).resolve().parents[1]
GPS_SPY = runpy.run_path(str(SATNAV / "compact-browser.py"))["GPS_SPY"]
SITE = os.environ.get("LINE_TEST_URL", "http://127.0.0.1:8873/atlas/v/satnav-layout-202611281330/")
A, B, C = [-2.605, 51.45], [-2.606, 51.451], [-2.607, 51.45]


def feature(kind, coords, **properties):
    return {"type": "Feature", "geometry": {"type": kind, "coordinates": coords}, "properties": properties}


def local_file(input_element, data):
    input_element.set_input_files({
        "name": "field.geojson", "mimeType": "application/geo+json",
        "buffer": json.dumps(data).encode(),
    })


def check_browser(browser, name, width, height):
    with browser.new_context(viewport={"width": width, "height": height}, is_mobile=True, has_touch=True) as context:
        context.add_init_script(GPS_SPY)
        page = context.new_page()
        leaks = []
        marker = "SV07-local-roundtrip-probe"
        page.on("request", lambda req: leaks.append(req.url) if marker in (req.url + (req.post_data or "")) else None)
        page.goto(SITE, wait_until="domcontentloaded")
        locate = page.locator("#satnav-location")
        expect(locate).to_be_enabled(timeout=45000)
        locate.tap()
        page.evaluate("at => window.__lineGpsTest.emit(at, 5)", A)
        survey = "document.querySelector('#satnav-compact').satnavSurvey"
        page.wait_for_function(survey + ".getFix() !== null")

        panel = page.locator("#satnav-layout")
        panel.locator("summary").tap()
        picker = panel.locator("input[type=file]")
        walk = panel.get_by_role("button", name="Use for walk")
        status = panel.get_by_role("status")
        data = {"type": "FeatureCollection", "features": [
            feature("LineString", [A, B], satnavRole="planned-route", name=marker),
            feature("Point", C, satnavRole="waypoint", name="Design pole"),
            feature("Point", A, satnavRole="walked-fix", timestampMs=1000, accuracyM=5),
            feature("LineString", [B, C], satnavRole="walked-track", timestampMs=[2000, 3000], accuracyM=[4, 4]),
        ]}
        local_file(picker, data)
        expect(status).to_contain_text("2 design · 2 recorded")
        assert panel.locator("select option").count() == 2
        assert page.evaluate(survey + ".getEndpoints()") == [A, None]
        panel.get_by_role("combobox").select_option(label=marker)
        walk.tap()
        assert page.evaluate(survey + ".getEndpoints()") == [A, B]
        panel.get_by_role("combobox").select_option(label="Design pole")
        walk.tap()
        assert page.evaluate(survey + ".getEndpoints()") == [A, C]
        assert page.evaluate("window.__lineGpsTest.records") == {"starts": [1], "stops": []}

        with page.expect_download() as export:
            panel.get_by_role("button", name="Save layout GeoJSON").tap()
        assert json.loads(export.value.path().read_text()) == data

        invalid = {**data, "crs": {"type": "name", "properties": {"name": "EPSG:27700"}}}
        local_file(picker, invalid)
        expect(status).to_contain_text("Import failed")
        assert page.evaluate(survey + ".getEndpoints()") == [A, C]
        assert panel.locator("select option").count() == 2
        local_file(picker, data["features"][2])
        expect(status).to_contain_text("0 design · 1 recorded")
        expect(walk).to_be_hidden()
        assert page.evaluate(survey + ".getEndpoints()") == [A, C]

        local_file(picker, {"schema": "ventus.gis-route.v1", "status": "available", "committed": True,
                            "route": feature("LineString", [C, B], type="export_cable"), "pins": []})
        expect(status).to_contain_text("1 design · 0 recorded")
        walk.tap()
        assert page.evaluate(survey + ".getEndpoints()") == [C, B]
        page.locator("#satnav-stop").tap()
        assert page.evaluate("window.__lineGpsTest.records") == {"starts": [1], "stops": [1]}
        assert not leaks, leaks
        print(f"{name} {width}×{height}: GIS import, layout selection, GPS continuity, role separation, "
              "GeoJSON download and failed-import recovery passed", flush=True)


if __name__ == "__main__":
    with sync_playwright() as driver:
        for engine in os.environ.get("LINE_TEST_BROWSERS", "chromium,webkit").split(","):
            options = {"args": ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader",
                                "--enable-unsafe-swiftshader"]} if engine == "chromium" else {}
            with getattr(driver, engine).launch(**options) as browser:
                for viewport in [(390, 664), (664, 390)]:
                    check_browser(browser, engine, *viewport)
