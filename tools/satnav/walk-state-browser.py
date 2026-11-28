"""Exercise the five walk states on a composed map using synthetic GPS fixes."""

import argparse
import re
from datetime import datetime, timezone
from pathlib import Path
from runpy import run_path

from playwright.sync_api import expect, sync_playwright


waypoint = run_path(str(Path(__file__).with_name("waypoint-browser.py")))
compact = waypoint["compact"]


def fix(page, point):
    # Keep this sample fresh even if a software-rendered map takes time to redraw.
    # All browser timers and animation frames continue to run between fixes.
    page.clock.set_fixed_time(datetime.now(timezone.utc))
    waypoint["emit_fix"](page, point)


def endpoints(page):
    return page.locator("#satnav-compact").evaluate("panel => panel.satnavSurvey.getEndpoints()")


def pick(page, field):
    page.locator("#satnav-" + field).tap()
    compact["map_canvas_tap"](page)
    point = endpoints(page)[0 if field == "from" else 1]
    assert point is not None
    return point


def watches(page, starts, stops):
    assert page.evaluate("window.__lineGpsTest.records") == {
        "starts": list(range(1, starts + 1)),
        "stops": list(range(1, stops + 1)),
    }


def state(page, expected, measured=None, target=None):
    start = page.locator("#satnav-walk-start")
    stop = page.locator("#satnav-walk-stop")
    guide = page.locator("#satnav-walk-guidance")
    if expected in ("ready", "stopped"):
        expect(start).to_be_visible()
        expect(start).to_be_enabled()
        expect(stop).to_be_hidden()
        assert endpoints(page)[1] is not None
        expect(guide).to_have_text("" if expected == "ready" else "Walk stopped")
        return
    expect(start).to_be_hidden()
    expect(stop).to_be_visible()
    if expected == "waiting":
        expect(guide).to_have_text(re.compile(r"Direct to pin · Waiting for .*GPS", re.I))
    elif expected == "arrived":
        expect(guide).to_have_text("Direct to pin · Arrived")
    elif expected == "guiding":
        expect(guide).to_have_text(re.compile(r"^Direct to pin · [0-9]+ m · [0-9]+° true$"))
        shown = int(guide.inner_text().split(" · ")[1].split()[0])
        actual = compact["surface_distance"](measured, target)
        assert abs(shown - actual) < 2, (shown, actual)
    else:
        raise ValueError(expected)


def to_first(page):
    target = pick(page, "to")
    assert endpoints(page) == [None, target]
    state(page, "ready")
    watches(page, 0, 0)
    start = page.locator("#satnav-walk-start")
    stop = page.locator("#satnav-walk-stop")
    start.tap()
    state(page, "waiting")
    page.evaluate("window.__lineGpsTest.deny()")
    expect(page.locator("#satnav-status")).to_contain_text("denied")
    state(page, "stopped")
    assert endpoints(page) == [None, target]
    watches(page, 1, 1)

    start.tap()
    state(page, "waiting")
    origin = [target[0], target[1] - 0.0006]
    fix(page, origin)
    state(page, "guiding", origin, target)
    assert endpoints(page) == [origin, target]
    fix(page, target)
    state(page, "arrived")
    stop.tap()
    state(page, "stopped")
    page.evaluate("at => window.__waypointSample(at, 90, 1)", target)
    state(page, "stopped")
    assert endpoints(page) == [origin, target]
    watches(page, 2, 2)

    start.tap()
    state(page, "waiting")
    fix(page, origin)
    state(page, "guiding", origin, target)
    fix(page, target)
    state(page, "arrived")
    # Replace TO after arrival. Its former arrival must not carry over.
    page.evaluate("window.__GRIDATLAS_V9_MAP__.jumpTo({center:[0.003,0.003],zoom:17})")
    new_target = pick(page, "to")
    state(page, "guiding", target, new_target)
    assert endpoints(page) == [origin, new_target]
    watches(page, 3, 2)
    stop.tap()
    state(page, "stopped")
    watches(page, 3, 3)


def gps_first_and_fixed_from(page):
    measured = [0, 0]
    page.locator("#satnav-location").tap()
    fix(page, measured)
    assert endpoints(page) == [measured, None]
    target = pick(page, "to")
    state(page, "ready")
    watches(page, 1, 0)
    start = page.locator("#satnav-walk-start")
    stop = page.locator("#satnav-walk-stop")
    start.tap()
    state(page, "guiding", measured, target)
    watches(page, 1, 0)
    stop.tap()
    state(page, "stopped")
    assert endpoints(page) == [measured, target]

    page.evaluate("window.__GRIDATLAS_V9_MAP__.jumpTo({center:[-0.002,-0.002],zoom:17})")
    fixed = pick(page, "from")
    assert compact["surface_distance"](fixed, measured) > 15
    start.tap()
    state(page, "waiting")
    page.evaluate("window.__lineGpsTest.deny()")
    state(page, "stopped")
    assert endpoints(page) == [fixed, target]
    start.tap()
    fix(page, measured)
    state(page, "guiding", measured, target)
    assert endpoints(page) == [fixed, target]
    stop.tap()
    state(page, "stopped")
    assert endpoints(page) == [fixed, target]
    watches(page, 3, 3)


SCENARIOS = (to_first, gps_first_and_fixed_from)


def check(browser, url, prepare_context=None, scenarios=SCENARIOS):
    for scenario in scenarios:
        with browser.new_context(viewport={"width": 390, "height": 664},
                                 is_mobile=True, has_touch=True) as context:
            context.add_init_script(waypoint["GPS_SPY"])
            if prepare_context:
                prepare_context(context)
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded")
            expect(page.locator("#satnav-to")).to_be_enabled(timeout=75000)
            expect(page.locator("#satnav-walk-start")).to_be_visible()
            page.evaluate("window.__GRIDATLAS_V9_MAP__.jumpTo({center:[0,0],zoom:17})")
            scenario(page)
            print(f"{browser.browser_type.name}: {scenario.__name__} passed", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("browser", choices=("chromium", "webkit"))
    parser.add_argument("url", help="Composed HTTPS or localhost Start walk entry")
    parser.add_argument("--executable", help="Optional installed browser binary")
    args = parser.parse_args()
    with sync_playwright() as playwright:
        options = {"executable_path": args.executable} if args.executable else {}
        if args.browser == "chromium":
            options["args"] = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        # Release the previous WebGL renderer before loading the next map.
        for scenario in SCENARIOS:
            with getattr(playwright, args.browser).launch(**options) as browser:
                check(browser, args.url, scenarios=(scenario,))
