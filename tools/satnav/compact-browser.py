"""Compact SatNav acceptance against the real GridAtlas composer."""

import math
import os
import re
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright


SITE = os.environ.get(
    'LINE_TEST_URL', 'http://127.0.0.1:8873/atlas/v/satnav-compact-202611281237/'
)
P1 = 'https://ventusltd.github.io/satnav/preview/9698781539e549deaa6ecaa4a2b34610c1f9fd29/nav/'
SOURCE = 'gridatlas-satnav-compact'
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
    deny() { for (const { error } of [...watches.values()]) error({code:1}); },
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


def check_browser(browser, label, width, height):
    context = browser.new_context(viewport={'width': width, 'height': height},
                                  is_mobile=True, has_touch=True)
    context.add_init_script(GPS_SPY)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(SITE, wait_until='domcontentloaded')
    page.wait_for_function("window.__GRIDATLAS_V9_MAP__?.getLayer('l-sat')", timeout=45000)
    expect(page.locator('#satnav-from')).to_be_enabled(timeout=45000)
    expect(page.locator('#satnav-to')).to_be_enabled()
    assert page.evaluate('window.__lineGpsTest.records.starts') == []
    canvas = page.locator('#map canvas.maplibregl-canvas').first.bounding_box()
    assert canvas and canvas['width'] * canvas['height'] >= width * height * .85, canvas
    page.evaluate("window.__GRIDATLAS_V9_MAP__.jumpTo({center: [-1.5, 51.5], zoom: 16})")
    page.locator('#satnav-to').tap()
    second = map_canvas_tap(page)
    page.locator('#satnav-from').tap()
    first = map_canvas_tap(page, second)
    found = overlay_roles(page, ['start-point', 'destination-point', SECTION])
    start = found['start-point']['geometry']['coordinates']
    end = found['destination-point']['geometry']['coordinates']
    assert surface_distance(start, first['coordinates']) < 2
    assert surface_distance(end, second['coordinates']) < 2
    # GPS denial must not erase either manual endpoint.
    page.locator('#satnav-location').tap()
    page.evaluate('window.__lineGpsTest.deny()')
    found = overlay_roles(page, ['start-point', 'destination-point'])
    assert found['start-point']['geometry']['coordinates'] == start
    assert found['destination-point']['geometry']['coordinates'] == end
    page.locator('#satnav-location').tap()
    page.evaluate('at => window.__lineGpsTest.emit(at, 8)', start)
    found = overlay_roles(page, [MEASURED, RING, 'start-point', 'destination-point'])
    assert found[MEASURED]['geometry']['coordinates'] == start
    assert found['destination-point']['geometry']['coordinates'] == end
    page.locator('#satnav-from').tap()
    map_canvas_tap(page, second)
    found = overlay_roles(page, ['start-point', 'destination-point', MEASURED])
    revised = found['start-point']['geometry']['coordinates']
    assert found['destination-point']['geometry']['coordinates'] == end
    page.locator('#satnav-to').tap()
    map_canvas_tap(page, first)
    found = overlay_roles(page, ['start-point', 'destination-point', MEASURED])
    assert found['start-point']['geometry']['coordinates'] == revised
    assert page.evaluate('window.__lineGpsTest.records.starts') == [1, 2]
    assert page.evaluate('window.__lineGpsTest.records.stops') == [1]
    next_fix = [start[0] + .0001, start[1]]
    page.evaluate('at => window.__lineGpsTest.emit(at, 8)', next_fix)
    page.wait_for_function("(at) => window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-satnav-compact').serialize().data.features.some(f => f.properties.role === 'measured-gps' && JSON.stringify(f.geometry.coordinates) === JSON.stringify(at))", arg=next_fix)
    page.evaluate('at => window.__lineGpsTest.emit(at, 75)', next_fix)
    overlay_roles(page, [MEASURED, RING])
    page.evaluate('at => window.__lineGpsTest.emit(at, 8, 12000)', next_fix)
    overlay_roles(page, ['start-point', 'destination-point'], absent=[MEASURED, RING])
    page.locator('#satnav-stop').tap()
    assert page.evaluate('window.__lineGpsTest.records.stops') == [1, 2]
    assert not errors, errors
    print(f'{label} {width}x{height}: real taps, full map, opt-in/denial, endpoint replacement, GPS and Stop passed', flush=True)
    context.close()


if __name__ == '__main__':
    with sync_playwright() as playwright:
        for engine in os.environ.get('LINE_TEST_BROWSERS', 'chromium,webkit').split(','):
            options = {'args': ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']} if engine == 'chromium' else {}
            browser = getattr(playwright, engine).launch(**options)
            try:
                for width, height in [(390, 664), (664, 390)]:
                    check_browser(browser, engine, width, height)
            finally:
                browser.close()
