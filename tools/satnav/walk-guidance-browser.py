"""Check the displayed live distance and true bearing on a composed Start walk map."""

import argparse
import math
import re
from pathlib import Path
from runpy import run_path

from playwright.sync_api import expect, sync_playwright


compact = run_path(str(Path(__file__).with_name("compact-browser.py")))
distance = compact["surface_distance"]
READING = re.compile(
    r"Direct to pin · (\d+) m(?: · (\d+)° true)?"
    r"(?: · Waypoint (\d+) of (\d+) · (\d+) m remaining)?"
)


def offset(point, east=0, north=0):
    """Small synthetic displacements in metres around a selected map point."""
    longitude, latitude = point
    return [longitude + math.degrees(east / (6371000 * math.cos(math.radians(latitude)))),
            latitude + math.degrees(north / 6371000)]


def true_bearing(start, end):
    lon1, lat1, lon2, lat2 = map(math.radians, [*start, *end])
    east = math.sin(lon2 - lon1) * math.cos(lat2)
    north = (math.cos(lat1) * math.sin(lat2)
             - math.sin(lat1) * math.cos(lat2) * math.cos(lon2 - lon1))
    return math.degrees(math.atan2(east, north)) % 360


def emit(page, point, accuracy=4):
    page.evaluate("args => window.__lineGpsTest.emit(...args)", [point, accuracy])


def check_reading(page, point, target, *, index=None, final=None, accuracy=4):
    message = page.locator("#satnav-walk-guidance").inner_text()
    match = READING.fullmatch(message)
    assert match, message
    metres, degrees, position, total, remaining = match.groups()
    expected = distance(point, target)
    assert abs(int(metres) - expected) < 1, (message, expected)
    if expected <= accuracy:
        assert degrees is None, message
    else:
        assert degrees is not None, message
        difference = (int(degrees) - true_bearing(point, target) + 180) % 360 - 180
        assert abs(difference) < 1, (message, true_bearing(point, target))
    if index is None:
        assert position is None, message
    else:
        assert (int(position), int(total)) == (index, 2), message
        assert abs(int(remaining) - expected - distance(target, final)) < 1, message
    return int(metres), degrees


def check(browser, url, width, height):
    with browser.new_context(viewport={"width": width, "height": height},
                             is_mobile=True, has_touch=True) as context:
        context.add_init_script(compact["GPS_SPY"])
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=75000)
        destination = page.locator("#satnav-to")
        start = page.locator("#satnav-walk-start")
        stop = page.locator("#satnav-walk-stop")
        expect(destination).to_be_enabled(timeout=75000)
        expect(start).to_be_visible()
        page.evaluate("window.__GRIDATLAS_V9_MAP__.jumpTo({center:[0,0],zoom:17})")
        destination.tap()
        compact["map_canvas_tap"](page)
        panel = page.locator("#satnav-compact")
        target = panel.evaluate("p => p.satnavSurvey.getEndpoints()[1]")
        assert target

        # With My location already running, one tap must use the current fix.
        origin = offset(target, east=-63)
        page.locator("#satnav-location").tap()
        emit(page, origin)
        start.tap()
        samples = [check_reading(page, origin, target)]
        for point in [offset(target, east=-35), offset(target, east=36, north=27),
                      offset(target, north=70)]:
            emit(page, point)
            samples.append(check_reading(page, point, target))
        plan = panel.evaluate("p => p.satnavSurvey.getEndpoints()")
        assert plan == [origin, target], plan
        expect(page.locator("#satnav-status")).to_contain_text("63 m planned")

        # The fix's accuracy circle contains the target, but is too wide for arrival.
        uncertain = offset(target, north=18)
        emit(page, uncertain, accuracy=20)
        check_reading(page, uncertain, target, accuracy=20)
        stop.tap()
        assert page.evaluate("window.__lineGpsTest.records") == {"starts": [1], "stops": [1]}

        # Drive the same controller used by the layout picker for an ordered VIA and TO.
        final = offset(target, north=80)
        panel.evaluate("(p, pins) => p.satnavSurvey.replacePlan(pins)", [origin, target, final])
        assert panel.evaluate("p => p.satnavSurvey.getPins().map(pin => pin.coordinate)") == [origin, target, final]
        start.tap()
        expect(page.locator("#satnav-walk-guidance")).to_contain_text("Waiting")
        emit(page, origin)
        check_reading(page, origin, target, index=1, final=final)
        emit(page, target)
        check_reading(page, target, final, index=2, final=final)
        emit(page, final)
        expect(page.locator("#satnav-walk-guidance")).to_have_text("Direct to pin · Arrived")
        stop.tap()
        assert page.evaluate("window.__lineGpsTest.records") == {"starts": [1, 2], "stops": [1, 2]}
        print(f"{browser.browser_type.name} {width}×{height} | {samples} | VIA → TO → Arrived", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("browser", choices=("chromium", "webkit"))
    parser.add_argument("url", help="The composed Start walk entry on HTTPS or localhost")
    parser.add_argument("--executable", help="Optional installed browser executable")
    args = parser.parse_args()
    with sync_playwright() as playwright:
        options = {"executable_path": args.executable} if args.executable else {}
        if args.browser == "chromium":
            options["args"] = ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader",
                               "--enable-unsafe-swiftshader"]
        for viewport in [(390, 664), (664, 390)]:
            with getattr(playwright, args.browser).launch(**options) as browser:
                check(browser, args.url, *viewport)
