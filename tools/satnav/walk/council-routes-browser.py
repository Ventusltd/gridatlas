"""Verify the walking-mode map overlay and direct fallback on the composed field map."""

import json
import os
import re
from pathlib import Path
from runpy import run_path

from playwright.sync_api import expect, sync_playwright


WALK = Path(__file__).resolve().parent
GPS_SPY = run_path(str(WALK.parent / "compact-browser.py"))["GPS_SPY"]
SITE = os.environ.get("LINE_TEST_URL", "http://127.0.0.1:8873/atlas/v/satnav-walk-202611281340/")
SURVEY = "document.querySelector('#satnav-compact').satnavSurvey"
OVERLAY = "window.__GRIDATLAS_V9_MAP__.getSource('satnav-active-walking-route').serialize().data.features"


def load_lines(filename, key):
    pack = json.loads((WALK / "council" / filename).read_text())
    return {key(feature): feature["geometry"]["coordinates"] for feature in pack["features"]}


def join_sections(*sections):
    points = list(sections[0])
    for section in sections[1:]:
        assert section[0] == points[-1]
        points.extend(section[1:])
    return points


def set_plan(page, points):
    page.evaluate(f"coords => {SURVEY}.replacePlan(coords)", points)
    assert page.evaluate(f"{SURVEY}.getPins().map(pin => pin.coordinate)") == points


def fix(page, coordinate):
    page.evaluate("at => window.__lineGpsTest.emit(at, 4)", coordinate)


def check_mapped(page, points, metres, council, closures_host):
    set_plan(page, [points[0], points[-1]])
    status = page.locator("#satnav-walk-guidance")
    source = page.locator("#satnav-walk-source")
    fix(page, points[0])
    expect(status).to_contain_text(f"Walking route · {metres} m remaining", timeout=20000)
    expect(status).to_contain_text("check current access")
    expect(source).to_be_visible()
    expect(source.locator("span")).to_contain_text(council)
    assert closures_host in source.get_by_text("Council closures", exact=True).get_attribute("href")
    drawn = page.evaluate(OVERLAY)
    assert len(drawn) == 1 and drawn[0]["properties"]["kind"] == "mapped-footpath", drawn
    geometry = drawn[0]["geometry"]
    assert geometry["type"] == "LineString" and len(geometry["coordinates"]) == len(points)
    for drawn_at, source_at in zip(geometry["coordinates"], points):
        assert all(abs(a - b) < 1e-7 for a, b in zip(drawn_at, source_at)), (drawn_at, source_at)
    fix(page, points[-1])
    expect(status).to_contain_text("Arrived at mapped path end")


def check_browser(browser, size, bristol, surrey):
    width, height = size
    with browser.new_context(viewport={"width": width, "height": height}, is_mobile=True, has_touch=True) as context:
        context.add_init_script(GPS_SPY)
        page = context.new_page()
        page.goto(SITE, wait_until="domcontentloaded")
        page.wait_for_function("window.__GRIDATLAS_V9_MAP__?.getLayer('l-sat')", timeout=60000)
        mode = page.get_by_role("combobox", name="Guidance mode")
        status = page.locator("#satnav-walk-guidance")
        stop = page.get_by_role("button", name="Stop walk", exact=True)
        expect(mode).to_have_value("direct", timeout=30000)
        bristol_path = join_sections(*(bristol[f"BCC/21/{i}"] for i in (10, 20, 30)))
        surrey_path = join_sections(*(surrey[i] for i in (5309, 7905, 9689, 6637)))

        set_plan(page, [bristol_path[0], bristol_path[-1]])
        mode.select_option("walking")
        expect(status).to_contain_text("Walking route ready", timeout=20000)
        assert page.evaluate("window.__lineGpsTest.records.starts") == []
        page.get_by_role("button", name="Start walk", exact=True).tap()
        check_mapped(page, bristol_path, 578, "Bristol City Council", "bristol.gov.uk")
        check_mapped(page, list(reversed(surrey_path)), 513, "Surrey County Council", "surreycc.gov.uk")

        # Same-city disconnected paths, an unsupported intermediate pin, and two off-coverage pins.
        outside = [[-1.5, 51.5], [-1.499, 51.501]]
        for plan in ([bristol_path[0], bristol["BCC/38/30"][-1]],
                     [bristol_path[0], outside[0], bristol_path[-1]], outside):
            set_plan(page, plan)
            expect(status).to_contain_text("Walking route unavailable here")
            expect(status).to_contain_text("Direct to pin")
            assert page.evaluate(OVERLAY) == []
            expect(page.locator("#satnav-walk-source")).to_be_hidden()

        mode.select_option("direct")
        fix(page, outside[0])
        expect(status).to_have_text(re.compile(r"Direct to pin · \d+ m · \d+° true"))
        assert page.evaluate(OVERLAY) == []
        assert page.evaluate(f"{SURVEY}.getEndpoints()") == outside
        stop.tap()
        expect(status).to_have_text("Walk stopped")
        assert page.evaluate("window.__lineGpsTest.records") == {"starts": [1], "stops": [1]}


if __name__ == "__main__":
    bristol_lines = load_lines("bristol-footpaths.geojson", lambda feature: feature["properties"]["ROUTE_CODE"])
    surrey_lines = load_lines("mickleham-footpaths-20260907.geojson", lambda feature: feature["id"])
    with sync_playwright() as playwright:
        for name in os.environ.get("LINE_TEST_BROWSERS", "chromium,webkit").split(","):
            name = name.strip()
            options = {"args": ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]} if name == "chromium" else {}
            browser = getattr(playwright, name).launch(**options)
            try:
                for viewport in [(390, 664), (664, 390)]:
                    check_browser(browser, viewport, bristol_lines, surrey_lines)
                    print(f"{name} {browser.version} {viewport}: Bristol 578 m, Mickleham 513 m, unavailable and direct fallback passed", flush=True)
            finally:
                browser.close()
