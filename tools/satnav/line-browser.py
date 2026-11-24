"""Detached browser checks for the GridAtlas line-tracking practice preview."""

import math
import os
import re
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright


SITE = os.environ.get(
    'LINE_TEST_URL', 'http://127.0.0.1:8873/atlas/v/satnav-line-preview/'
)
P1 = 'https://ventusltd.github.io/satnav/preview/9698781539e549deaa6ecaa4a2b34610c1f9fd29/nav/'
SOURCE = 'gridatlas-satnav-line-position'
SECTION = 'selected-section'
MEASURED = 'measured-gps'
RING = 'gps-accuracy'
NEAREST = 'nearest-on-section'

GPS_SPY = """(() => {
  let nextId = 0;
  const watches = new Map();
  const records = { starts: [], stops: [] };
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition(success, error) {
        const id = ++nextId;
        watches.set(id, { success, error });
        records.starts.push(id);
        return id;
      },
      clearWatch(id) {
        records.stops.push(id);
        watches.delete(id);
      },
    },
  });
  window.__lineGpsTest = {
    records,
    emit(coordinates, accuracy, age = 0) {
      const coords = { longitude: coordinates[0], latitude: coordinates[1], accuracy };
      const result = { coords, timestamp: Date.now() - age };
      for (const { success } of watches.values()) success(result);
    },
  };
})()"""


def surface_distance(first, second):
    lon1, lat1 = map(math.radians, first)
    lon2, lat2 = map(math.radians, second)
    a = math.sin((lat2 - lat1) / 2) ** 2
    b = math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6_371_000 * 2 * math.asin(min(1, math.sqrt(a + b)))


def leg_point(start, end, fraction, offset):
    lon, lat = [a + (b - a) * fraction for a, b in zip(start, end)]
    x_scale = 111_195 * math.cos(math.radians(lat))
    y_scale = 111_195
    east = (end[0] - start[0]) * x_scale
    north = (end[1] - start[1]) * y_scale
    norm = math.hypot(east, north)
    return [lon + offset * north / (norm * x_scale), lat - offset * east / (norm * y_scale)]


def map_canvas_tap(page, excluded=None):
    target = page.wait_for_function("""excluded => {
      const map = window.__GRIDATLAS_V9_MAP__;
      if (map.isMoving()) return null;
      const canvas = map.getCanvas();
      const rect = canvas.getBoundingClientRect();
      for (const fraction of [.83, .74, .65, .54, .44]) {
        const y = Math.round(rect.top + rect.height * fraction);
        for (const side of [.24, .7, .42, .57]) {
          const x = Math.round(rect.left + rect.width * side);
          if (excluded && Math.hypot(x - excluded.x, y - excluded.y) < 90) continue;
          if (document.elementFromPoint(x, y) !== canvas) continue;
          return {x, y, coordinates: map.unproject([x - rect.left, y - rect.top]).toArray()};
        }
      }
      return null;
    }""", arg=excluded, timeout=15000).json_value()
    page.touchscreen.tap(target['x'], target['y'])
    return target


def overlay_roles(page, required, absent=()):
    data = page.wait_for_function("""({source, required, absent}) => {
      const data = window.__GRIDATLAS_V9_MAP__?.getSource(source)?.serialize()?.data;
      if (!Array.isArray(data?.features)) return null;
      const found = Object.fromEntries(data.features.map(feature => [feature.properties.role, feature]));
      return required.every(role => found[role]) && absent.every(role => !found[role]) ? found : null;
    }""", arg={'source': SOURCE, 'required': required, 'absent': absent}, timeout=15000)
    return data.json_value()


def check_basemap(page, selector, visibility, geometry):
    page.locator(selector).tap()
    page.wait_for_function(
        """visibility => window.__GRIDATLAS_V9_MAP__.getLayoutProperty('l-sat', 'visibility') === visibility""",
        arg=visibility,
    )
    assert overlay_roles(page, [SECTION])[SECTION]['geometry']['coordinates'] == geometry


def check_browser(browser, label):
    context = browser.new_context(
        viewport={'width': 390, 'height': 664},
        is_mobile=True,
        has_touch=True,
    )
    context.add_init_script(GPS_SPY)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(SITE, wait_until='domcontentloaded')
    page.wait_for_function("window.__GRIDATLAS_V9_MAP__?.getLayer('l-sat')", timeout=45000)
    expect(page.locator('#line-open')).to_be_visible(timeout=45000)
    page.locator('#line-open').tap()
    page.locator('#line-draw').tap()
    assert page.evaluate('window.__lineGpsTest.records.starts') == []
    page.evaluate("""window.__GRIDATLAS_V9_MAP__.jumpTo({center: [-1.5, 51.5], zoom: 15})""")
    discarded_point = map_canvas_tap(page)
    overlay_roles(page, ['start-point'], absent=[SECTION])
    page.locator('#line-cancel').tap()
    expect(page.locator('#line-status')).to_have_text('Selection cancelled.')
    map_canvas_tap(page, discarded_point)
    overlay_roles(page, [], absent=['start-point', SECTION])
    print(f'{label}: cancellation removes the start point and disarms map taps', flush=True)

    page.locator('#line-draw').tap()
    first = map_canvas_tap(page)
    second = map_canvas_tap(page, first)
    expected_section = [first['coordinates'], second['coordinates']]
    selected = overlay_roles(page, [SECTION])[SECTION]
    geometry = selected['geometry']['coordinates']
    assert len(geometry) == 2
    assert 80 < surface_distance(*geometry) < 1000
    for expected, actual in zip(expected_section, geometry):
        assert surface_distance(expected, actual) < 2, 'Selected vertex differs from canvas tap'
    assert page.evaluate('window.__lineGpsTest.records.starts') == []
    print(f'{label}: two real map taps created a practice section without starting GPS', flush=True)

    check_basemap(page, '#line-satellite', 'visible', geometry)
    check_basemap(page, '#line-dark', 'none', geometry)
    print(f'{label}: dark and satellite controls preserved the selected section', flush=True)

    expect(page.locator('#line-start')).to_be_enabled()
    page.locator('#line-start').tap()
    assert page.evaluate('window.__lineGpsTest.records.starts') == [1]
    expected_fix = leg_point(*geometry, fraction=0.35, offset=40)
    page.evaluate('at => window.__lineGpsTest.emit(at, 8)', expected_fix)
    overlay = overlay_roles(page, [SECTION, MEASURED, RING, NEAREST])
    actual_fix = overlay[MEASURED]['geometry']['coordinates']
    nearest = overlay[NEAREST]['geometry']['coordinates']
    assert actual_fix == expected_fix, 'Measured GPS has been moved'
    assert abs(surface_distance(actual_fix, nearest) - 40) < 2
    ring = overlay[RING]['geometry']['coordinates'][0]
    assert len(ring) >= 25 and ring[0] == ring[-1]
    assert all(abs(surface_distance(actual_fix, edge) - 8) < 0.2 for edge in ring), (
        'Accuracy ring must be centred on measured GPS'
    )
    assert overlay[SECTION]['geometry']['coordinates'] == geometry
    expect(page.locator('#line-accuracy')).to_contain_text('8')
    offset = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*m\b', page.locator('#line-offset').inner_text())
    assert offset and abs(float(offset[1]) - 40) < 2
    expect(page.locator('#line-progress')).to_be_visible()
    before_progress = page.locator('#line-progress').inner_text()
    next_fix = leg_point(*geometry, fraction=0.65, offset=40)
    page.evaluate('at => window.__lineGpsTest.emit(at, 8)', next_fix)
    expect(page.locator('#line-progress')).not_to_have_text(before_progress)
    print(f'{label}: exact GPS marker, 8 m accuracy circle, separate 40 m offset and updating progress', flush=True)

    page.evaluate('at => window.__lineGpsTest.emit(at, 75)', expected_fix)
    overlay_roles(page, [SECTION, MEASURED, RING], absent=[NEAREST])
    page.evaluate('at => window.__lineGpsTest.emit(at, 8, 12000)', expected_fix)
    overlay_roles(page, [SECTION], absent=[MEASURED, RING, NEAREST])
    page.locator('#line-stop').tap()
    assert page.evaluate('window.__lineGpsTest.records.stops') == [1]
    assert not errors, errors
    print(f'{label}: poor and stale data withheld projection and Stop cleared the watch', flush=True)

    page.locator('#line-compass').tap()
    page.wait_for_url(P1 + '?*', timeout=20000)
    expect(page.locator('#destination')).to_have_text('Practice line end', timeout=20000)
    params = parse_qs(urlsplit(page.url).query)
    assert params['mode'] == ['compass']
    destination = [float(params['longitude'][0]), float(params['latitude'][0])]
    assert surface_distance(geometry[-1], destination) < 0.01
    assert page.evaluate('window.__lineGpsTest.records.starts') == []
    print(f'{label}: compass handoff kept the exact end point and waited for Start', flush=True)
    context.close()


def run():
    requested = os.environ.get('LINE_TEST_BROWSERS', 'webkit,chromium').split(',')
    with sync_playwright() as playwright:
        for engine in requested:
            options = {}
            if engine == 'chromium':
                options['args'] = [
                    '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
                    '--enable-unsafe-swiftshader',
                ]
            browser = getattr(playwright, engine).launch(**options)
            try:
                check_browser(browser, engine)
            finally:
                browser.close()


if __name__ == '__main__':
    run()
