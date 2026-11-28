"""Touch and GPS regression for the composed GridAtlas waypoint map."""

import math
import os
import re
from pathlib import Path
from runpy import run_path

from playwright.sync_api import TimeoutError as PlaywrightTimeout, expect, sync_playwright


# V1 and V2 use the same geolocation contract and independent distance oracle.
compact = run_path(str(Path(__file__).with_name('compact-browser.py')))
GPS_SPY = compact['GPS_SPY'] + ''';
(() => {
  const gps = navigator.geolocation;
  const watch = gps.watchPosition.bind(gps);
  let lastHandler;
  gps.watchPosition = (success, error, options) => {
    lastHandler = success;
    return watch(success, error, options);
  };
  // A browser may deliver an already-queued callback after clearWatch.
  window.__waypointSample = ([longitude, latitude], heading, speed) => lastHandler({
    coords:{longitude, latitude, accuracy:5, heading, speed}, timestamp:Date.now()
  });
})()'''
surface_distance = compact['surface_distance']
SITE = os.environ.get('LINE_TEST_URL', 'http://127.0.0.1:8873/atlas/v/satnav-waypoints-202611281300/')
PLANNED = 'gridatlas-satnav-waypoints'
POSITION = 'gridatlas-satnav-position'

READ_PINS = '''({source, count, previous}) => {
  const data = window.__GRIDATLAS_V9_MAP__.getSource(source)?.serialize()?.data;
  if (!Array.isArray(data?.features)) return null;
  const points = data.features.filter(f => f.geometry.type === 'Point' &&
    ['start-point', 'waypoint', 'destination-point'].includes(f.properties.role));
  const pins = points.map(f => ({id:f.properties.pinId, role:f.properties.role, at:f.geometry.coordinates}));
  if (count != null && pins.length !== count) return null;
  if (previous && JSON.stringify(previous) === JSON.stringify(pins)) return null;
  return pins;
}'''


def pins(page, count=None, previous=None):
    try:
        return page.wait_for_function(READ_PINS, arg={'source': PLANNED, 'count': count,
                                      'previous': previous}, timeout=10000).json_value()
    except PlaywrightTimeout as error:
        observed = page.evaluate(READ_PINS, {'source': PLANNED})
        status = page.locator('#satnav-status').inner_text()
        raise AssertionError(f'Expected {count} pins, saw {observed}. Map status {status!r}') from error


def clear_map_pixel(page, cell, used=()):
    """Find a visible canvas pixel near the chosen grid cell, outside controls."""
    return page.wait_for_function('''({cell,used}) => {
      const map = window.__GRIDATLAS_V9_MAP__;
      if (map.isMoving()) return null;
      const canvas = map.getCanvas(), rect = canvas.getBoundingClientRect();
      const xs = [.22, .32, .42, .52, .62, .72, .82, .91], ys = [.48, .58, .68, .78, .88];
      const preferred = [xs[cell % xs.length], ys[Math.floor(cell / xs.length) % ys.length]];
      const candidates = xs.flatMap(x => ys.map(y => [x,y]));
      candidates.sort((a,b) => Math.hypot(a[0]-preferred[0],a[1]-preferred[1]) -
                                  Math.hypot(b[0]-preferred[0],b[1]-preferred[1]));
      for (const [fx,fy] of candidates) {
        const x = Math.round(rect.left + rect.width*fx), y = Math.round(rect.top + rect.height*fy);
        if (used.some(([px,py]) => Math.hypot(px-x,py-y) < 8)) continue;
        const previous = used[used.length-1];
        if (previous && Math.hypot(previous[0]-x,previous[1]-y) < 90) continue;
        if (document.elementFromPoint(x,y) === canvas) {
          return {x,y,at:map.unproject([x-rect.left,y-rect.top]).toArray()};
        }
      }
      return null;
    }''', arg={'cell':cell, 'used':used}, timeout=15000).json_value()


def place(page, control, cell, used=None):
    page.locator('#satnav-' + control).tap()
    pixel = clear_map_pixel(page, cell, used or ())
    page.touchscreen.tap(pixel['x'], pixel['y'])
    if used is not None:
        used.append([pixel['x'], pixel['y']])
    return pixel['at']


def emit_fix(page, at, accuracy=5, age=0):
    page.evaluate('args => window.__lineGpsTest.emit(...args)', [at, accuracy, age])


def measured(page, at):
    page.wait_for_function('''({source,at,missing}) => {
      const features = window.__GRIDATLAS_V9_MAP__.getSource(source)?.serialize()?.data?.features;
      if (!Array.isArray(features)) return false;
      const fix = features.find(f => f.properties.role === 'measured-gps');
      const ring = features.some(f => f.properties.role === 'gps-accuracy');
      return missing ? !fix && !ring : ring && JSON.stringify(fix?.geometry.coordinates) === JSON.stringify(at);
    }''', arg={'source': POSITION, 'at': at, 'missing': at is None}, timeout=10000)


def check_bearing(page, planned, at):
    page.evaluate('at => window.__waypointSample(at, 77, 1.3)', at)
    expect(page.locator('#satnav-status')).to_contain_text('GPS course 77°')
    guide = page.locator('#satnav-guide')
    expect(guide).to_contain_text('remaining')
    match = re.search(r'Pin (\d+) · (\d+) m · (\d+)° true', guide.inner_text())
    assert match, guide.inner_text()
    index, metres, degrees = map(int, match.groups())
    end = planned[index - 1]['at']
    lon1, lat1, lon2, lat2 = map(math.radians, [*at, *end])
    east = math.sin(lon2 - lon1) * math.cos(lat2)
    north = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(lon2 - lon1)
    expected = math.degrees(math.atan2(east, north)) % 360
    assert abs((degrees - expected + 180) % 360 - 180) <= 1
    assert abs(surface_distance(at, end) - metres) < 2
    page.evaluate('at => window.__waypointSample(at, 77, 0)', at)
    expect(page.locator('#satnav-status')).not_to_contain_text('GPS course')


def check_map_gestures(page, expected):
    map_object = 'window.__GRIDATLAS_V9_MAP__'
    assert page.evaluate(f'{map_object}.dragPan.isEnabled() && {map_object}.touchZoomRotate.isEnabled()')
    pixel = clear_map_pixel(page, 13)
    centre = page.evaluate(f'{map_object}.getCenter().toArray()')
    page.mouse.move(pixel['x'], pixel['y'])
    page.mouse.down()
    page.mouse.move(pixel['x'] - 40, pixel['y'] - 16, steps=5)
    page.mouse.up()
    page.wait_for_function('at => !window.__GRIDATLAS_V9_MAP__.isMoving() && Math.abs(window.__GRIDATLAS_V9_MAP__.getCenter().lng-at[0])>1e-6', arg=centre)
    assert pins(page, len(expected)) == expected


def check_browser(browser, name, width, height):
    with browser.new_context(viewport={'width': width, 'height': height},
                             is_mobile=True, has_touch=True) as context:
        context.add_init_script(GPS_SPY)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(SITE, wait_until='domcontentloaded')
        page.wait_for_function("window.__GRIDATLAS_V9_MAP__?.getLayer('l-sat')", timeout=60000)
        expect(page.locator('#satnav-from')).to_be_enabled(timeout=45000)
        assert page.evaluate('window.__lineGpsTest.records.starts') == []
        canvas = page.locator('#map canvas.maplibregl-canvas').first.bounding_box()
        assert canvas and canvas['width'] * canvas['height'] >= width * height * .85
        page.evaluate('() => { window.__GRIDATLAS_V9_MAP__.jumpTo({center:[-1.50,51.50],zoom:17}); }')

        first = place(page, 'from', 16)
        last = place(page, 'to', 9)
        original = pins(page, 2)
        assert [p['role'] for p in original] == ['start-point', 'destination-point']
        assert surface_distance(first, original[0]['at']) < 2
        assert surface_distance(last, original[-1]['at']) < 2

        page.locator('#satnav-location').tap()
        page.evaluate('window.__lineGpsTest.deny()')
        assert pins(page, 2) == original
        page.locator('#satnav-location').tap()
        gps_start = [first[0] + .0003, first[1] + .0002]
        emit_fix(page, gps_start)
        measured(page, gps_start)
        assert pins(page, 2) == original, 'Start GPS replaced the planned FROM'
        manual = place(page, 'from', 14)
        current = pins(page, 2)
        assert surface_distance(manual, current[0]['at']) < 2
        assert current[-1] == original[-1]
        check_bearing(page, current, [manual[0] + .001, manual[1] + .001])

        # Each point uses an actual tap on the canvas. TO must stay at the end.
        tapped = []
        for i in range(12):
            before = current
            coordinate = place(page, 'add', i, tapped)
            current = pins(page, len(before) + 1)
            assert current[:-2] == before[:-1] and current[-1] == before[-1]
            assert current[-2]['role'] == 'waypoint'
            assert surface_distance(coordinate, current[-2]['at']) < 2
        assert len({p['id'] for p in current}) == len(current)
        page.locator('#satnav-undo').tap()
        assert pins(page, len(before)) == before

        # A pin dropped at the measured fix remains fixed when the walker moves.
        at = [first[0] + .00013, first[1] + .00011]
        emit_fix(page, at)
        measured(page, at)
        page.locator('#satnav-add').tap()
        page.locator('#satnav-use-fix').tap()
        current = pins(page, len(before) + 1)
        assert current[-2]['at'] == at
        moved = [at[0] + .00018, at[1]]
        emit_fix(page, moved)
        measured(page, moved)
        assert pins(page, len(current)) == current

        # Replacing an endpoint preserves the IDs and positions of all other pins.
        previous = current
        endpoint = place(page, 'to', 17)
        current = pins(page, len(previous), previous)
        assert current[:-1] == previous[:-1] and current[-1]['id'] == previous[-1]['id']
        assert surface_distance(endpoint, current[-1]['at']) < 2
        page.locator('#satnav-undo').tap()
        assert pins(page, len(previous), current) == previous

        # Editing, reordering and removing are exercised through the on-map editor.
        current = previous
        page.locator('#satnav-edit').tap()
        selected = page.locator('#satnav-selected')
        number = int(re.search(r'Pin (\d+) of', selected.inner_text()).group(1))
        for _ in range(abs(5 - number)):
            page.locator('#satnav-next' if number < 5 else '#satnav-prev').tap()
        expect(selected).to_contain_text('Pin 5 of')
        expect(page.locator('#satnav-earlier')).to_be_enabled()
        before_ids = [p['id'] for p in current]
        page.locator('#satnav-earlier').tap()
        reordered = pins(page, len(current), current)
        after_ids = [p['id'] for p in reordered]
        assert sorted(after_ids) == sorted(before_ids)
        assert sum(a != b for a, b in zip(before_ids, after_ids)) == 2
        page.locator('#satnav-undo').tap()
        assert pins(page, len(current), reordered) == current
        if not page.locator('#satnav-remove').is_visible():
            page.locator('#satnav-edit').tap()
        page.locator('#satnav-remove').tap()
        removed = pins(page, len(current) - 1)
        assert len(set(before_ids) - {p['id'] for p in removed}) == 1
        page.locator('#satnav-undo').tap()
        assert pins(page, len(current)) == current
        if page.locator('#satnav-remove').is_visible():
            page.locator('#satnav-edit').tap()
        check_map_gestures(page, current)

        assert page.evaluate('window.__lineGpsTest.records') == {'starts':[1, 2], 'stops':[1]}
        emit_fix(page, moved, age=15000)
        measured(page, None)
        assert pins(page, len(current)) == current
        page.locator('#satnav-stop').tap()
        assert page.evaluate('window.__lineGpsTest.records.stops') == [1, 2]
        page.evaluate('at => window.__waypointSample(at, 77, 1.3)', at)
        measured(page, None)
        assert not errors, errors
        print(f'{name} {width}x{height}: 14 ordered map pins, undo, edit, GPS, pan and Stop passed', flush=True)


if __name__ == '__main__':
    with sync_playwright() as playwright:
        for engine in os.environ.get('LINE_TEST_BROWSERS', 'chromium,webkit').split(','):
            engine = engine.strip()
            options = {'args': ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
                                '--enable-unsafe-swiftshader']} if engine == 'chromium' else {}
            browser = getattr(playwright, engine).launch(**options)
            try:
                for size in [(390, 664), (664, 390)]:
                    check_browser(browser, engine, *size)
            finally:
                browser.close()
