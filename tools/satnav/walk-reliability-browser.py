"""Run the mobile GPS reliability regression against a composed Start walk candidate."""
import argparse
from importlib.util import module_from_spec, spec_from_file_location
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


READOUT = "#satnav-status,#satnav-guide,#satnav-walk-guidance"
BEARING = r"\d+\s*°\s*true"

# Retain callbacks after clearWatch to exercise callbacks already queued by the browser.
GPS_AUDIT = """(() => {
  const active = new Map(), callbacks = new Map();
  const systemNow = Date.now.bind(Date);
  let next = 0, hidden = false, shift = 0;
  Object.defineProperty(document, 'hidden', {configurable:true, get:() => hidden});
  Object.defineProperty(document, 'visibilityState', {configurable:true, get:() => hidden ? 'hidden' : 'visible'});
  window.__walkAudit = {
    starts: [], stops: [],
    controlClock() { Date.now = () => systemNow() + shift; },
    advance(ms) { shift += ms; },
    visibility(value) {
      hidden = value;
      document.dispatchEvent(new Event('visibilitychange'));
    },
    fix(at,accuracy=4,age=0,id=null) {
      const sample = {coords:{longitude:at[0], latitude:at[1], accuracy}, timestamp:Date.now()-age};
      for (const cb of id === null ? active.values() : [callbacks.get(id)]) cb.success(sample);
    },
    error(code,id=null) {
      for (const cb of id === null ? active.values() : [callbacks.get(id)]) cb.error({code});
    },
    counts() { return [this.starts.length, this.stops.length, active.size]; },
  };
  Object.defineProperty(navigator, 'geolocation', {configurable:true, value:{
    watchPosition(success,error) {
      const id = ++next, cb = {success, error};
      callbacks.set(id,cb); active.set(id,cb); window.__walkAudit.starts.push(id);
      return id;
    },
    clearWatch(id) { window.__walkAudit.stops.push(id); active.delete(id); },
  }});
})()"""


def readout(page):
    return page.locator(READOUT).evaluate_all("nodes => nodes.filter(n => n.getClientRects().length).map(n => n.innerText).join(' ')")


def expect_message(page, pattern):
    page.wait_for_function("""([selector, pattern]) => {
      const message = [...document.querySelectorAll(selector)].filter(n => n.getClientRects().length).map(n => n.innerText).join(' ');
      return new RegExp(pattern, 'i').test(message);
    }""", arg=[READOUT, pattern], timeout=6000)


def expect_no_bearing(page):
    assert not re.search(BEARING, readout(page), re.I), readout(page)


def counts(page):
    return page.evaluate("window.__walkAudit.counts()")


def emit(page, at, accuracy=4, age=0, watch=None):
    page.evaluate("args => window.__walkAudit.fix(...args)", [at, accuracy, age, watch])


def measured_points(page):
    return page.evaluate("""() => {
      const map = window.__GRIDATLAS_V9_MAP__, points = {};
      for (const source of ['gridatlas-satnav-waypoints','gridatlas-satnav-position']) {
        for (const f of map.getSource(source)?.serialize()?.data?.features || []) {
          if (f.geometry.type === 'Point') points[f.properties.role] = f.geometry.coordinates;
        }
      }
      return points;
    }""")


def check(browser, url, tap_map, prepare_context=None):
    context = browser.new_context(viewport={"width": 390, "height": 664}, is_mobile=True, has_touch=True)
    try:
        context.add_init_script(GPS_AUDIT)
        if prepare_context:
            prepare_context(context)
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=75000)
        to = page.locator("#satnav-to")
        start = page.locator("#satnav-walk-start")
        stop = page.locator("#satnav-walk-stop")
        expect(to).to_be_enabled(timeout=75000)
        expect(start).to_have_count(1)
        page.evaluate("""() => {
          window.__walkAudit.controlClock();
          window.__GRIDATLAS_V9_MAP__.jumpTo({center:[0,0], zoom:17});
        }""")
        to.tap()
        target = tap_map(page)["coordinates"]
        origin = [target[0] - 0.000565, target[1]]
        closer = [origin[0] + 0.00025, origin[1]]
        expect(start).to_be_enabled()
        assert counts(page) == [0, 0, 0]

        start.tap()
        assert counts(page) == [1, 0, 1]
        page.evaluate("window.__walkAudit.error(1)")
        expect_message(page, "denied|allow location")
        expect(start).to_be_enabled()
        assert counts(page) == [1, 1, 0]
        destination = measured_points(page)["destination-point"]
        emit(page, origin, watch=1)
        assert "measured-gps" not in measured_points(page)

        start.tap()
        assert counts(page) == [2, 1, 1]
        emit(page, origin, 100)
        expect_message(page, "accur|weak|poor|usable")
        expect_no_bearing(page)
        emit(page, origin)
        expect_message(page, BEARING)
        page.evaluate("window.__walkAudit.advance(11000)")
        expect_message(page, "stale|fresh|waiting")
        expect_no_bearing(page)
        emit(page, origin)
        expect_message(page, BEARING)

        page.set_viewport_size({"width": 664, "height": 390})
        expect(stop).to_be_visible()
        assert counts(page) == [2, 1, 1]
        page.evaluate("window.__walkAudit.visibility(true)")
        emit(page, closer)
        expect_no_bearing(page)
        assert "measured-gps" not in measured_points(page)
        page.evaluate("window.__walkAudit.advance(3000); window.__walkAudit.visibility(false)")
        emit(page, closer, age=500)
        expect_no_bearing(page)
        assert "measured-gps" not in measured_points(page)
        expect_message(page, "fresh|wait|resum|acquir|signal|GPS")
        emit(page, closer)
        expect_message(page, BEARING)
        assert counts(page) == [2, 1, 1]

        stop.tap()
        assert counts(page) == [2, 2, 0]
        emit(page, origin, watch=2)
        page.evaluate("window.__walkAudit.error(2,2)")
        expect(start).to_be_enabled()
        expect_no_bearing(page)
        assert measured_points(page).get("destination-point") == destination
        assert "measured-gps" not in measured_points(page)

        page.set_viewport_size({"width": 390, "height": 664})
        page.locator("#satnav-location").tap()
        assert counts(page) == [3, 2, 1]
        emit(page, origin)
        start.tap()
        expect_message(page, BEARING)
        assert counts(page) == [3, 2, 1]
        stop.tap()
        assert counts(page) == [3, 3, 0]

        # A user can press My location and Start while the system is still
        # waiting for permission or the first fix, then stop before it arrives.
        page.locator("#satnav-location").tap()
        assert counts(page) == [4, 3, 1]
        start.tap()
        assert counts(page) == [4, 3, 1]
        expect_no_bearing(page)
        stop.tap()
        assert counts(page) == [4, 4, 0]
        emit(page, origin, watch=4)
        page.evaluate("window.__walkAudit.error(1, 4)")
        expect(page.locator("#satnav-walk-guidance")).to_have_text("Walk stopped")
        assert "measured-gps" not in measured_points(page)

        # Start a new walk. A late success or denial from the previous watch
        # must neither install its position nor clear the replacement watch.
        start.tap()
        assert counts(page) == [5, 4, 1]
        emit(page, closer, watch=4)
        page.evaluate("window.__walkAudit.error(1, 4)")
        assert counts(page) == [5, 4, 1]
        expect_no_bearing(page)
        assert "measured-gps" not in measured_points(page)
        emit(page, origin, watch=5)
        expect_message(page, BEARING)
        guide = page.locator("#satnav-walk-guidance")
        current_guidance = guide.inner_text()
        for old_watch in (1, 2, 3, 4):
            emit(page, closer, watch=old_watch)
            page.evaluate("id => window.__walkAudit.error(1, id)", old_watch)
        assert counts(page) == [5, 4, 1]
        expect(guide).to_have_text(current_guidance)
        points = measured_points(page)
        assert points["measured-gps"] == origin
        assert points["destination-point"] == destination
        stop.tap()
        assert counts(page) == [5, 5, 0]
        print(f"{browser.browser_type.name}: 5 watch starts, 5 clears, 0 active; "
              "cold Start 1, Start with existing or pending GPS 0 additional; "
              "denial/retry, weak/stale, rotation, resume and retired callbacks passed")
    finally:
        context.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("browser", choices=("chromium", "webkit"))
    parser.add_argument("url", help="Composed HTTPS or localhost Start walk entry")
    parser.add_argument("--executable", help="Optional installed browser binary")
    parser.add_argument("--compact-test", type=Path, default=Path(__file__).with_name("compact-browser.py"))
    args = parser.parse_args()
    spec = spec_from_file_location("compact_map_test", args.compact_test)
    compact = module_from_spec(spec)
    spec.loader.exec_module(compact)
    with sync_playwright() as playwright:
        options = {"executable_path": args.executable} if args.executable else {}
        if args.browser == "chromium":
            options["args"] = ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        browser = getattr(playwright, args.browser).launch(**options)
        try:
            check(browser, args.url, compact.map_canvas_tap)
        finally:
            browser.close()
