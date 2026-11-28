"""Verify two nearby, explicitly armed placements and ordinary unarmed map zoom."""

import os
from pathlib import Path
from runpy import run_path

from playwright.sync_api import sync_playwright

GPS_SPY = run_path(str(Path(__file__).with_name('compact-browser.py')))['GPS_SPY']
SITE = os.environ.get('LINE_TEST_URL', 'http://127.0.0.1:8873/atlas/v/satnav-walk-202611281340/')
PLAN = [[-1.501, 51.5], [-1.497, 51.5]]


def open_map(browser, width, height):
    context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True)
    context.add_init_script(GPS_SPY)
    page = context.new_page()
    page.goto(SITE, wait_until='domcontentloaded')
    page.wait_for_function("document.querySelector('#satnav-compact')?.satnavSurvey?.getMap()?.getLayer('l-sat')", timeout=60000)
    page.locator('#satnav-location').tap()
    page.evaluate("window.__lineGpsTest.emit([-1.5,51.5],5)")
    page.wait_for_function("document.querySelector('#satnav-compact').satnavSurvey.getFix()?.accuracyM===5")
    page.evaluate('''() => {
      const canvas = document.querySelector('#satnav-compact').satnavSurvey.getMap().getCanvas();
      window.rapidContacts = [];
      canvas.addEventListener('touchstart', event => window.rapidContacts.push(event.timeStamp), {passive:true});
    }''')
    return context, page


def clear_pixel(page):
    return page.wait_for_function('''() => {
      const map = document.querySelector('#satnav-compact').satnavSurvey.getMap();
      if (map.isMoving()) return null;
      const r = map.getCanvas().getBoundingClientRect();
      for (const fy of [.69,.78,.53,.87]) for (const fx of [.67,.72,.58,.43,.33]) {
        const x = Math.round(r.left + r.width*fx), y = Math.round(r.top + r.height*fy);
        if ([0,5,15,35,75].every(d => document.elementFromPoint(x+d,y) === map.getCanvas())) return [x,y];
      }
      return null;
    }''', timeout=10000).json_value()


def rapid_pair(page, dx):
    box = page.locator('#satnav-add').bounding_box()
    bx, by = round(box['x'] + box['width']/2), round(box['y'] + box['height']/2)
    for _ in range(3):
        page.wait_for_timeout(450)  # Keep independent trials outside the preceding double-tap window.
        page.evaluate('''plan => {
          const api = document.querySelector('#satnav-compact').satnavSurvey;
          api.getMap().jumpTo({center:[-1.5,51.5],zoom:16});
          api.replacePlan(plan);
          window.rapidContacts.length = 0;
        }''', PLAN)
        x, y = clear_pixel(page)
        # Four real contacts. The toolbar tap between sites means these are separate pin edits.
        page.touchscreen.tap(bx, by)
        page.touchscreen.tap(x, y)
        page.touchscreen.tap(bx, by)
        page.touchscreen.tap(x+dx, y)
        page.wait_for_timeout(400)  # Allow a wrongly triggered 300 ms camera animation to finish.
        seen = page.evaluate('''() => {
          const api = document.querySelector('#satnav-compact').satnavSurvey;
          return {pins:api.getPins(),zoom:api.getMap().getZoom(),armed:document.querySelector('#satnav-add').getAttribute('aria-pressed'),times:window.rapidContacts};
        }''')
        assert len(seen['times']) == 2, seen
        elapsed = seen['times'][1] - seen['times'][0]
        if elapsed >= 280:
            continue  # The host did not send a rapid pair; retry the whole independent trial.
        pins = seen['pins']
        assert len(pins) == 4 and len({pin['id'] for pin in pins}) == 4, (dx,elapsed,seen)
        assert abs(seen['zoom']-16) < .001 and seen['armed'] == 'false', (dx,elapsed,seen)
        assert (pins[1]['coordinate'] == pins[2]['coordinate']) == (dx == 0), (dx,seen)
        return
    raise AssertionError(f'Could not deliver a sub-280 ms test gesture at {dx} px')


def check(browser, width, height):
    context, page = open_map(browser, width, height)
    try:
        for dx in (0, 5, 15, 35, 75):
            rapid_pair(page, dx)
        x, y = clear_pixel(page)
        page.wait_for_timeout(450)
        page.touchscreen.tap(x,y)
        page.touchscreen.tap(x+3,y)
        page.wait_for_function("document.querySelector('#satnav-compact').satnavSurvey.getMap().getZoom()>16.9")
        page.evaluate("document.querySelector('#satnav-compact').satnavSurvey.getMap().doubleClickZoom.disable()")
        page.locator('#satnav-add').tap()
        assert page.evaluate("!document.querySelector('#satnav-compact').satnavSurvey.getMap().doubleClickZoom.isEnabled()")
        assert page.evaluate('window.__lineGpsTest.records') == {'starts':[1],'stops':[]}
        page.locator('#satnav-stop').tap()
        assert page.evaluate('window.__lineGpsTest.records') == {'starts':[1],'stops':[1]}
    finally:
        context.close()


if __name__ == '__main__':
    with sync_playwright() as playwright:
        for name in os.environ.get('LINE_TEST_BROWSERS','chromium,webkit').split(','):
            options = {'args':['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']} if name == 'chromium' else {}
            browser = getattr(playwright,name).launch(**options)
            try:
                for width,height in [(390,664),(664,390)]:
                    check(browser,width,height)
                    print(f'{name} {width}×{height}: rapid pin placement, ordinary zoom and GPS lifecycle passed',flush=True)
            finally:
                browser.close()
