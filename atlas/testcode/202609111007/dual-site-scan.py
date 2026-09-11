import json, re, time
from pathlib import Path
from playwright.sync_api import sync_playwright

URL='https://ventusltd.github.io/gridatlas/atlas/testcode/202609111007/'
OUT=Path('dual-site-scan'); OUT.mkdir(exist_ok=True)
SITES=[
  {'id':'little-crow','label':'Little Crow','lon':-0.57983,'lat':53.57695,'zoom':14.2,'early':'2026-04-30','late':'2026-08-13'},
  {'id':'bradenstoke','label':'Bradenstoke / MOD Lyneham','lon':-1.9820,'lat':51.5085,'zoom':13.7,'early':'2026-04-30','late':'2026-08-25'},
  {'id':'bradenstoke-west','label':'Bradenstoke western edge','lon':-1.9950,'lat':51.5115,'zoom':15.0,'early':'2026-04-30','late':'2026-08-25'},
]

def wait_map(page):
    page.goto(URL, wait_until='domcontentloaded', timeout=60000)
    page.wait_for_function("window.__GRIDATLAS_V9_MAP__ && window.__GRIDATLAS_SATELLITE_TEST__", timeout=60000)

def open_survey(page):
    page.get_by_role('button', name=re.compile(r'GRID', re.I)).first.click()
    page.wait_for_selector('#satellite-survey', state='visible', timeout=10000)
    page.evaluate("document.querySelector('#satellite-survey').open=true")

def set_dates(page):
    page.evaluate("""() => {
      const a=document.querySelector('#survey-start'), b=document.querySelector('#survey-end');
      a.value='2026-02-01'; b.value='2026-09-11';
      a.dispatchEvent(new Event('change',{bubbles:true})); b.dispatchEvent(new Event('change',{bubbles:true}));
    }""")

def refresh(page):
    page.click('#survey-refresh')
    page.wait_for_function("""() => {
      const s=window.__GRIDATLAS_SATELLITE_TEST__?.snapshot();
      return s && s.scenes>0 && s.mode==='s2' && s.date;
    }""", timeout=60000)
    page.wait_for_timeout(1800)

def choose_date(page, prefix):
    opts=page.locator('#sat-scene option')
    texts=opts.all_text_contents()
    for i,t in enumerate(texts):
        if t.startswith(prefix):
            value=opts.nth(i).get_attribute('value')
            page.select_option('#sat-scene', value)
            page.wait_for_function("p=>window.__GRIDATLAS_SATELLITE_TEST__.snapshot().date?.startsWith(p)", arg=prefix, timeout=60000)
            page.wait_for_timeout(1800)
            return page.evaluate("window.__GRIDATLAS_SATELLITE_TEST__.snapshot()")
    raise RuntimeError(f'No scene found for {prefix}')

def capture(page, site):
    page.evaluate("([lon,lat,z])=>window.__GRIDATLAS_V9_MAP__.jumpTo({center:[lon,lat],zoom:z})", [site['lon'],site['lat'],site['zoom']])
    page.wait_for_timeout(800)
    open_survey(page); set_dates(page); refresh(page)
    options=page.locator('#sat-scene option').all_text_contents()
    early=choose_date(page,site['early'])
    page.click('#survey-view'); page.wait_for_timeout(400)
    page.screenshot(path=str(OUT/f"{site['id']}-{site['early']}.png"),full_page=False)
    open_survey(page); late=choose_date(page,site['late'])
    page.click('#survey-view'); page.wait_for_timeout(400)
    page.screenshot(path=str(OUT/f"{site['id']}-{site['late']}.png"),full_page=False)
    return {'site':site,'early':early,'late':late,'scene_options':options}

report={'url':URL,'generated_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sites':[],'errors':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':430,'height':932},device_scale_factor=1)
    page.on('pageerror',lambda e: report['errors'].append('page:'+str(e)))
    wait_map(page)
    for site in SITES:
        try: report['sites'].append(capture(page,site))
        except Exception as e: report['sites'].append({'site':site,'error':str(e)})
    browser.close()
Path(OUT/'report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
if any('error' in x for x in report['sites']): raise SystemExit(1)
