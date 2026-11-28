"""Exercise the real V2 GridAtlas map with touch input and simulated GPS."""

import importlib.util
import os
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


VERSION = 'atlas/v/satnav-waypoints-202611281300/'
PLAN = 'gridatlas-satnav-waypoints'
POSITION = 'gridatlas-satnav-position'

# Keep the V1 watch spy and geodesic tolerance shared between both generations.
spec = importlib.util.spec_from_file_location('compact_browser', Path(__file__).with_name('compact-browser.py'))
compact = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compact)


def tap_canvas(page, step):
    # Find exposed canvas, including when the pin editor occupies the left of the phone.
    target = page.wait_for_function("""step => {
      const map = window.__GRIDATLAS_V9_MAP__;
      if (map.isMoving()) return null;
      const canvas = map.getCanvas(), rect = canvas.getBoundingClientRect();
      const slots = [[.66,.28],[.85,.73],[.72,.56],[.91,.37],[.63,.81],[.81,.47],[.74,.69],[.93,.58]];
      for (let i = 0; i < slots.length; i++) {
        const [px,py] = slots[(step+i) % slots.length];
        const x = Math.round(rect.left + px*rect.width), y = Math.round(rect.top + py*rect.height);
        if (document.elementFromPoint(x,y) !== canvas) continue;
        return {x,y,at:map.unproject([x-rect.left,y-rect.top]).toArray()};
      }
      return null;
    }""", arg=step, timeout=15000).json_value()
    page.touchscreen.tap(target['x'], target['y'])
    return target['at']


def pins(page, count):
    return page.wait_for_function("""({id,count}) => {
      const features=window.__GRIDATLAS_V9_MAP__?.getSource(id)?.serialize().data?.features;
      if (!features) return null;
      const result=features.filter(f=>f.geometry.type==='Point').sort((a,b)=>a.properties.order-b.properties.order);
      return result.length===count ? result.map(f=>({id:f.properties.pinId,role:f.properties.role,at:f.geometry.coordinates})) : null;
    }""", arg={'id': PLAN, 'count': count}, timeout=10000).json_value()


def measured_position(page, at):
    page.wait_for_function("""({id,at,present}) => {
      const data=window.__GRIDATLAS_V9_MAP__.getSource(id)?.serialize()?.data;
      if (!data) return false;
      const point=data.features.find(f=>f.properties.role==='measured-gps');
      const ring=data.features.find(f=>f.properties.role==='gps-accuracy');
      return present ? point && ring && JSON.stringify(point.geometry.coordinates)===JSON.stringify(at) : !point && !ring;
    }""", arg={'id': POSITION, 'at': at, 'present': at is not None}, timeout=10000)


def check(browser, engine, width, height, url):
    context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True)
    context.add_init_script(compact.GPS_SPY)
    try:
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda err: errors.append(str(err)))
        page.goto(url, wait_until='domcontentloaded')
        page.wait_for_function("window.__GRIDATLAS_V9_MAP__?.getLayer('l-sat')", timeout=90000)
        control = lambda name: page.locator('#satnav-' + name)
        expect(control('from')).to_be_enabled(timeout=45000)
        expect(control('add')).to_be_enabled()
        assert page.evaluate('window.__lineGpsTest.records') == {'starts': [], 'stops': []}
        canvas = page.locator('#map canvas.maplibregl-canvas').first.bounding_box()
        assert canvas and canvas['width'] * canvas['height'] >= .85 * width * height, canvas
        expect(control('access').locator('summary')).to_be_visible()
        assert not control('access').evaluate('el => el.open')
        page.evaluate('window.__GRIDATLAS_V9_MAP__.jumpTo({center:[-1.5,51.5],zoom:16})')

        control('to').tap()
        at_end = tap_canvas(page, 0)
        control('from').tap()
        at_start = tap_canvas(page, 1)
        endpoints = pins(page, 2)
        assert [p['role'] for p in endpoints] == ['start-point', 'destination-point']
        assert compact.surface_distance(endpoints[0]['at'], at_start) < 2
        assert compact.surface_distance(endpoints[-1]['at'], at_end) < 2
        for index in range(4):
            control('add').tap()
            picked = tap_canvas(page, index+2)
            route = pins(page, 3+index)
            assert route[0] == endpoints[0] and route[-1] == endpoints[-1]
            assert compact.surface_distance(route[-2]['at'], picked) < 2
        assert len({p['id'] for p in route}) == 6
        assert [p['role'] for p in route[1:-1]] == ['waypoint']*4

        control('location').tap()
        page.evaluate('at => window.__lineGpsTest.emit(at, 4)', endpoints[0]['at'])
        measured_position(page, endpoints[0]['at'])
        expect(control('guide')).to_have_text(re.compile(r'Pin 2.*° true.*remaining'))
        page.evaluate('at => window.__lineGpsTest.emit(at, 4)', route[1]['at'])
        measured_position(page, route[1]['at'])
        expect(control('guide')).to_have_text(re.compile(r'Pin 3.*remaining'))

        control('edit').tap()
        control('earlier').tap()
        reordered = pins(page, 6)
        assert [p['id'] for p in reordered] == [p['id'] for p in [*route[:3],route[4],route[3],route[5]]]
        control('undo').tap()
        assert pins(page, 6) == route
        control('replace').tap()
        replacement = tap_canvas(page, 6)
        revised = pins(page, 6)
        assert revised[:4] == route[:4] and revised[-1] == route[-1]
        assert revised[4]['id'] == route[4]['id'] and compact.surface_distance(revised[4]['at'],replacement) < 2
        control('remove').tap()
        assert pins(page, 5) == revised[:4] + revised[-1:]
        control('undo').tap()
        assert pins(page, 6) == revised
        control('edit').tap()

        # A selected GPS pin is a copy at tap time. Moving GPS continues independently.
        page.evaluate('at => window.__lineGpsTest.emit(at, 4)', route[2]['at'])
        control('add').tap()
        control('use-fix').tap()
        copied = pins(page, 7)
        assert copied[-2]['at'] == route[2]['at']
        page.evaluate('at => window.__lineGpsTest.emit(at, 4)', route[3]['at'])
        measured_position(page, route[3]['at'])
        assert pins(page, 7) == copied
        assert page.evaluate('window.__lineGpsTest.records') == {'starts':[1], 'stops':[]}
        page.evaluate('at => window.__lineGpsTest.emit(at, 4, 12000)', route[3]['at'])
        measured_position(page, None)
        control('stop').tap()
        expect(control('stop')).to_be_disabled()
        assert page.evaluate('window.__lineGpsTest.records') == {'starts':[1], 'stops':[1]}
        assert pins(page, 7) == copied
        assert not errors, errors
        print(f'{engine} {width}x{height} passed: seven pins, ordered bearing, edit/delete/undo, independent GPS and Stop', flush=True)
    except Exception:
        if not page.is_closed():
            try:
                print(page.evaluate("""() => ({
                  status: document.querySelector('#satnav-status')?.textContent,
                  guide: document.querySelector('#satnav-guide')?.textContent,
                  live: !!document.querySelector('#satnav-compact')?.satnavSurvey?.getFix(),
                  measured: window.__GRIDATLAS_V9_MAP__?.getSource('gridatlas-satnav-position')?.serialize()?.data?.features?.map(f => f.properties.role),
                  watch: window.__lineGpsTest?.records
                })"""), flush=True)
            except Exception:
                pass
        raise
    finally:
        context.close()


if __name__ == '__main__':
    site = os.environ.get('WAYPOINT_TEST_URL', 'http://127.0.0.1:8873/' + VERSION)
    with sync_playwright() as playwright:
        for name in os.environ.get('WAYPOINT_TEST_BROWSERS', 'chromium,webkit').split(','):
            opts = {'args': ['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']} if name=='chromium' else {}
            browser = getattr(playwright, name).launch(**opts)
            try:
                for w,h in [(390,664),(664,390)]:
                    check(browser,name,w,h,site)
            finally:
                browser.close()
