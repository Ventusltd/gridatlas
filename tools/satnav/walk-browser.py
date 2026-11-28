"""Accept the phone's header, direct walking guidance and map gestures in the real composer."""

import os
import re
from pathlib import Path
from runpy import run_path

from playwright.sync_api import expect, sync_playwright


waypoints = run_path(str(Path(__file__).with_name('waypoint-browser.py')))
SITE = os.environ.get('LINE_TEST_URL', 'http://127.0.0.1:8873/atlas/v/satnav-walk-202611281340/')
MAP = 'window.__GRIDATLAS_V9_MAP__'
SURVEY = "document.querySelector('#satnav-compact').satnavSurvey"


def assert_header(page):
    metrics = page.wait_for_function('''() => {
      const bar = document.querySelector('#gridatlas-menu-bar');
      const from = document.querySelector('#satnav-from');
      const brand = bar?.querySelector('.gm-brand-slot .ventus-main');
      if (!brand?.getBoundingClientRect().width || !from?.getBoundingClientRect().height) return null;
      function hittable(el) {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width/2, r.y + r.height/2));
      }
      const menus = [...bar.querySelectorAll('.gm-title')].filter(el => el.getBoundingClientRect().width);
      return {gap:from.getBoundingClientRect().top - bar.getBoundingClientRect().bottom,
              brand:hittable(brand), menus:menus.map(hittable)};
    }''', timeout=25000).json_value()
    assert metrics['gap'] >= 7.5 and metrics['brand'], metrics
    assert metrics['menus'] and all(metrics['menus']), metrics
    titles = page.locator('#gridatlas-menu-bar .gm-title:visible')
    for title in titles.all():
        title.tap()
        expect(title).to_have_attribute('aria-expanded', 'true')
        options = page.locator('#gridatlas-menu-bar .gm-open .gm-panel :is(button,a,[role=button],input):visible')
        if options.count():
            assert options.first.evaluate('''el => {
              const b=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));
            }'''), f'{title.inner_text()} menu is covered'
            title.tap()
            return metrics['gap']
        title.tap()
    raise AssertionError('The header has no usable menu action')


def south_of(pin, metres):
    return [pin[0], pin[1] - metres / 111_195]


def check_distance(page, expected):
    value = page.wait_for_function('''metres => {
      const text = document.querySelector('#satnav-walk-guidance')?.innerText || '';
      const distance = text.match(/([0-9.]+)\\s*m\\b/i);
      const bearing = text.match(/([0-9.]+)\\s*°(?:\\s*true)?/i);
      if (!distance || !bearing) return false;
      const degrees = Number(bearing[1]) % 360;
      return Math.abs(Number(distance[1])-metres) <= 2 && Math.min(degrees,360-degrees) <= 2 && text;
    }''', arg=expected, timeout=10000).json_value()
    return value


def check_close_placements(page):
    add = page.locator('#satnav-add')
    baseline = page.evaluate(f'{SURVEY}.getPins().length')
    zoom = page.evaluate(f'{MAP}.getZoom()')
    add.tap()
    point = waypoints['clear_map_pixel'](page, 23)
    button = add.bounding_box()
    x, y = point['x'], point['y']
    assert page.evaluate('''([x,y]) => document.elementFromPoint(x+5,y) === window.__GRIDATLAS_V9_MAP__.getCanvas()''', [x,y])
    # These are two separately armed placements within MapLibre's double-tap tolerance.
    page.touchscreen.tap(x,y)
    page.touchscreen.tap(round(button['x'] + button['width']/2), round(button['y'] + button['height']/2))
    page.touchscreen.tap(x+5,y)
    waypoints['pins'](page, baseline + 2)
    assert abs(page.evaluate(f'{MAP}.getZoom()')-zoom) < .01
    blank = waypoints['clear_map_pixel'](page, 35, [[x,y],[x+5,y]])
    page.touchscreen.tap(blank['x'],blank['y'])
    page.touchscreen.tap(blank['x'],blank['y'])
    page.wait_for_function('z => window.__GRIDATLAS_V9_MAP__.getZoom() >= z+.8', arg=zoom, timeout=6000)
    waypoints['pins'](page, baseline + 2)


def check_browser(browser, name, width, height):
    with browser.new_context(viewport={'width': width, 'height': height}, has_touch=True, is_mobile=True) as context:
        context.add_init_script(waypoints['GPS_SPY'])
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(SITE, wait_until='domcontentloaded')
        page.wait_for_function("window.__GRIDATLAS_V9_MAP__?.getLayer('l-sat')", timeout=60000)
        start = page.locator('#satnav-walk-start')
        stop = page.locator('#satnav-walk-stop')
        expect(start).to_be_visible(timeout=30000)
        gap = assert_header(page)
        expect(page.locator('#satnav-access:visible,#field-land-access:visible')).to_have_count(1)
        assert page.evaluate('window.__lineGpsTest.records.starts') == []
        page.evaluate(f'() => {{ {MAP}.jumpTo({{center:[-1.5,51.5],zoom:17}}); }}')
        target = waypoints['place'](page, 'to', 23)
        expect(start).to_be_enabled()
        start.tap()
        assert page.evaluate('window.__lineGpsTest.records.starts') == [1]
        waypoints['emit_fix'](page, south_of(target,63), accuracy=4)
        expect(page.locator('#satnav-walk-mode')).to_have_value('direct')
        expect(page.locator('#satnav-walk-guidance')).to_contain_text('Direct to pin')
        transitions = [check_distance(page,63)]
        saved = page.evaluate(f'{SURVEY}.getEndpoints()')
        for metres in [35,49]:
            waypoints['emit_fix'](page, south_of(target,metres), accuracy=4)
            transitions.append(check_distance(page,metres))
            assert page.evaluate(f'{SURVEY}.getEndpoints()') == saved
        waypoints['emit_fix'](page, south_of(target,2), accuracy=4)
        expect(page.locator('#satnav-walk-guidance')).to_contain_text(re.compile('arriv',re.I))
        if stop.is_enabled():
            stop.tap()
        assert page.evaluate('window.__lineGpsTest.records') == {'starts':[1], 'stops':[1]}
        assert page.evaluate(f'{SURVEY}.getEndpoints()') == saved
        ended = page.locator('#satnav-walk-guidance').inner_text()
        page.evaluate('at => window.__waypointSample(at,90,1.0)', south_of(target,63))
        assert page.locator('#satnav-walk-guidance').inner_text() == ended

        # Start again with My location already watching and a fresh usable fix.
        page.locator('#satnav-location').tap()
        away = south_of(target,63)
        waypoints['emit_fix'](page, away, accuracy=4)
        start.tap()
        check_distance(page,63)
        assert page.evaluate('window.__lineGpsTest.records.starts') == [1,2]
        stop.tap()
        assert page.evaluate('window.__lineGpsTest.records.stops') == [1,2]
        mode = page.locator('#satnav-walk-mode')
        mode.select_option('walking')
        expect(page.locator('#satnav-walk-guidance')).to_contain_text('Walking route unavailable here', timeout=20000)
        assert page.evaluate("window.__GRIDATLAS_V9_MAP__.getSource('satnav-active-walking-route').serialize().data.features.length") == 0
        mode.select_option('direct')
        expect(start).to_be_enabled()
        assert page.evaluate(f'{SURVEY}.getEndpoints()') == saved
        check_close_placements(page)
        assert not errors, errors
        print(f'{name} {width}x{height}: header gap {gap:.1f}px, menu hit tests, TO-first/GPS-first, '
              f'{transitions}, arrival, stopped watch and close placements/double-tap passed', flush=True)


if __name__ == '__main__':
    with sync_playwright() as playwright:
        for engine in os.environ.get('LINE_TEST_BROWSERS','chromium,webkit').split(','):
            engine = engine.strip()
            options = {'args':['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']} if engine == 'chromium' else {}
            browser = getattr(playwright,engine).launch(**options)
            try:
                for size in [(390,664),(664,390)]:
                    check_browser(browser,engine,*size)
            finally:
                browser.close()
