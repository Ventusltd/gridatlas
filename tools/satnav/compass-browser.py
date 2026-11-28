"""Touch-test the real GridAtlas compass page, using simulated heading and GPS samples."""

import importlib.util
import math
import os
from pathlib import Path
import re

from playwright.sync_api import expect, sync_playwright


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('satnav_compact_browser', HERE / 'compact-browser.py')
compact = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compact)

SITE = os.environ.get('LINE_TEST_URL', 'http://127.0.0.1:8873/atlas/v/satnav-compass-202611281255/')
SENSOR = """(() => {
  let answer = 'granted';
  let resolvePending;
  const requests = [];
  const Orientation = window.DeviceOrientationEvent || class extends Event {};
  if (!window.DeviceOrientationEvent) {
    Object.defineProperty(window, 'DeviceOrientationEvent', {configurable: true, value: Orientation});
  }
  Object.defineProperty(Orientation, 'requestPermission', {
    configurable: true,
    value(absolute) {
      requests.push(absolute);
      return answer === 'pending' ? new Promise(resolve => { resolvePending = resolve; }) : Promise.resolve(answer);
    },
  });
  window.__fieldSensorTest = {
    requests,
    isolate() {
      for (const type of ['deviceorientation', 'deviceorientationabsolute']) {
        window.addEventListener(type, event => { if (event.isTrusted) event.stopImmediatePropagation(); }, true);
      }
    },
    permission(value) { answer = value; },
    release() { resolvePending('granted'); },
    sample(type, properties) {
      const event = new Event(type);
      for (const [key, value] of Object.entries(properties)) {
        Object.defineProperty(event, key, {value});
      }
      window.dispatchEvent(event);
    },
  };
})()"""


def initial_bearing(from_point, to_point):
    lon1, lat1, lon2, lat2 = map(math.radians, [*from_point, *to_point])
    delta = lon2 - lon1
    east = math.sin(delta) * math.cos(lat2)
    north = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta)
    return math.degrees(math.atan2(east, north)) % 360


def expect_true_bearing(reading, origin_label, start, end):
    degree = round(initial_bearing(start, end))
    # The real geodesy module and the map tap projection can round at a degree boundary.
    values = '|'.join(f'{(degree + offset) % 360:03d}' for offset in (-1, 0, 1))
    expect(reading).to_have_text(re.compile(rf'{origin_label} to TO (?:{values})° true'))


def check_notice(page):
    notice = page.locator('#field-land-access')
    summary = notice.locator('summary')
    expect(summary).to_be_visible()
    expect(notice.locator('p')).to_be_hidden()
    summary.tap()
    expect(notice.locator('p')).to_contain_text(re.compile(r'access.*permission.*restrictions.*work safely', re.I))
    summary.tap()
    # The reusable cartridge must defer to a successor map that already supplies its own notice.
    page.evaluate("""() => {
      const sibling = document.createElement('details');
      sibling.id = 'satnav-access';
      sibling.innerHTML = '<summary>Check access before entry</summary>';
      document.body.append(sibling);
    }""")
    expect(notice).to_be_hidden()
    expect(page.locator('#satnav-access summary')).to_be_visible()
    page.locator('#satnav-access').evaluate('element => element.remove()')
    expect(summary).to_be_visible()


def sample(page, event_type, **properties):
    page.evaluate('([type, properties]) => window.__fieldSensorTest.sample(type, properties)',
                  [event_type, properties])


def check_heading(page):
    toggle = page.locator('#field-compass-toggle')
    reading = page.locator('#field-compass-reading')
    angle = page.evaluate('screen.orientation?.angle ?? window.orientation ?? 0')
    assert page.evaluate('window.__fieldSensorTest.requests') == []
    page.evaluate("window.__fieldSensorTest.permission('denied')")
    toggle.tap()
    expect(reading).to_contain_text(re.compile('permission denied', re.I))
    expect(toggle).to_have_attribute('aria-pressed', 'false')
    page.evaluate("window.__fieldSensorTest.permission('granted')")
    toggle.tap()
    expect(toggle).to_have_attribute('aria-pressed', 'true')
    assert page.evaluate('window.__fieldSensorTest.requests') == [True, True]
    before = reading.inner_text()
    sample(page, 'deviceorientation', alpha=37, beta=0, gamma=0, absolute=False)
    expect(reading).to_have_text(before)
    sample(page, 'deviceorientation', webkitCompassHeading=134, webkitCompassAccuracy=4, beta=0, gamma=0)
    expect(reading).to_have_text(f'Heading {(134 + angle) % 360:03d}° magnetic')
    sample(page, 'deviceorientation', webkitCompassHeading=57, webkitCompassAccuracy=-1, beta=0, gamma=0)
    expect(reading).to_contain_text(re.compile('unavailable', re.I))
    sample(page, 'deviceorientationabsolute', alpha=270, beta=0, gamma=0, absolute=True)
    expect(reading).to_have_text(f'Heading {(90 + angle) % 360:03d}° sensor')
    assert page.evaluate('window.__lineGpsTest.records.starts') == []


def check_viewport(browser, label, width, height):
    with browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True) as context:
        context.add_init_script(compact.GPS_SPY)
        context.add_init_script(SENSOR)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(SITE, wait_until='domcontentloaded')
        page.wait_for_function("window.__GRIDATLAS_V9_MAP__?.getLayer('l-sat')", timeout=90000)
        expect(page.locator('#satnav-from')).to_be_enabled(timeout=30000)
        expect(page.locator('#field-compass-toggle')).to_be_visible()
        # The composer replaces the document. Install the hardware-event filter
        # on the final Window listeners before delivering deterministic samples.
        page.evaluate('window.__fieldSensorTest.isolate()')
        canvas = page.locator('#map canvas.maplibregl-canvas').first.bounding_box()
        assert canvas and canvas['width'] * canvas['height'] >= width * height * .85, canvas
        check_notice(page)
        check_heading(page)

        page.evaluate("window.__GRIDATLAS_V9_MAP__.jumpTo({center: [-1.5, 51.5], zoom: 16})")
        page.locator('#satnav-to').tap()
        to_tap = compact.map_canvas_tap(page)
        page.locator('#satnav-from').tap()
        from_tap = compact.map_canvas_tap(page, to_tap)
        overlay = compact.overlay_roles(page, ['start-point', 'destination-point', compact.SECTION])
        start = overlay['start-point']['geometry']['coordinates']
        end = overlay['destination-point']['geometry']['coordinates']
        assert compact.surface_distance(start, from_tap['coordinates']) < 2
        assert compact.surface_distance(end, to_tap['coordinates']) < 2
        bearing = page.locator('#field-target-bearing')
        expect_true_bearing(bearing, 'FROM', start, end)

        page.locator('#satnav-location').tap()
        page.evaluate('window.__lineGpsTest.deny()')
        overlay = compact.overlay_roles(page, ['start-point', 'destination-point'])
        assert overlay['start-point']['geometry']['coordinates'] == start
        assert overlay['destination-point']['geometry']['coordinates'] == end
        page.locator('#satnav-location').tap()
        page.evaluate('at => window.__lineGpsTest.emit(at, 8)', start)
        compact.overlay_roles(page, [compact.MEASURED, compact.RING])
        # Deliberately move away from the line so the live bearing differs from the planned bearing.
        moved = compact.leg_point(start, end, .5, 50)
        page.evaluate('at => window.__lineGpsTest.emit(at, 8)', moved)
        expect_true_bearing(bearing, 'GPS', moved, end)
        page.evaluate('at => window.__lineGpsTest.emit(at, 75)', moved)
        expect(bearing).to_contain_text(re.compile('accurate GPS fix', re.I))
        page.evaluate('at => window.__lineGpsTest.emit(at, 8)', end)
        expect(bearing).to_contain_text(re.compile('within GPS accuracy', re.I))
        # A fresh heading has its own expiry, independent of the existing GPS watch.
        reading = page.locator('#field-compass-reading')
        page.clock.install()
        sample(page, 'deviceorientation', webkitCompassHeading=15, webkitCompassAccuracy=3)
        expect(reading).to_contain_text('magnetic')
        page.clock.fast_forward(10001)
        expect(reading).to_have_text('Waiting for a fresh heading')
        assert page.evaluate('window.__lineGpsTest.records') == {'starts': [1, 2], 'stops': [1]}
        page.locator('#satnav-stop').tap()
        expect(page.locator('#field-compass-toggle')).to_have_attribute('aria-pressed', 'false')
        sample(page, 'deviceorientation', webkitCompassHeading=247, webkitCompassAccuracy=2)
        expect(reading).to_have_text('')
        assert page.evaluate('window.__lineGpsTest.records.stops') == [1, 2]
        compact.overlay_roles(page, ['start-point', 'destination-point'], absent=[compact.MEASURED, compact.RING])
        # The same cartridge subscribes to the successor panel's non-bubbling Stop.
        page.evaluate("window.__fieldSensorTest.permission('pending')")
        page.locator('#field-compass-toggle').tap()
        page.evaluate("""() => {
          document.querySelector('#satnav-compact').dispatchEvent(new Event('satnav:stop'));
          window.__fieldSensorTest.release();
        }""")
        expect(page.locator('#field-compass-toggle')).to_have_attribute('aria-pressed', 'false')
        sample(page, 'deviceorientation', webkitCompassHeading=247, webkitCompassAccuracy=2)
        expect(reading).to_have_text('')
        assert not errors, errors
        print(f'{label} {width}x{height}: real map taps, access notice, opt-in heading, bearing, accuracy and Stop passed', flush=True)


if __name__ == '__main__':
    with sync_playwright() as playwright:
        for engine in os.environ.get('LINE_TEST_BROWSERS', 'chromium,webkit').split(','):
            engine = engine.strip()
            options = {'args': ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
                                '--enable-unsafe-swiftshader']} if engine == 'chromium' else {}
            browser = getattr(playwright, engine).launch(**options)
            try:
                for size in [(390, 664), (664, 390)]:
                    check_viewport(browser, engine, *size)
            finally:
                browser.close()
