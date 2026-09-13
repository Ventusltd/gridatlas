"""Delay real network responses, never replace data or production code."""
import asyncio,json,pathlib,shutil,time,re
from playwright.async_api import async_playwright
BASE=pathlib.Path(__file__).with_name('202609131625-12588-load.py')
ns={};exec(BASE.read_text().replace('asyncio.run(main())',''),ns)
URL=ns['URL']; INIT=ns['INIT']; OUT=pathlib.Path('causal-evidence');OUT.mkdir(exist_ok=True)

async def test(browser,name,pattern,delay=20):
    context=await browser.new_context(viewport={'width':393,'height':852},is_mobile=True,has_touch=True,device_scale_factor=1)
    await context.add_init_script(INIT)
    page=await context.new_page();t=time.monotonic()
    r={'name':name,'url':URL,'delayed_pattern':pattern,'delay_seconds':delay,'held':[],'responses':[],'errors':[],'snapshots':[]}
    def now():return round(time.monotonic()-t,3)
    async def route(route):
        if pattern and re.search(pattern,route.request.url):
            item={'url':route.request.url,'held_at':now()};r['held'].append(item)
            await asyncio.sleep(delay);item['released_at']=now()
        try:await route.continue_()
        except Exception:pass
    # Route every scenario, including control, so cache-interception conditions match.
    await context.route('**/*',route)
    page.on('pageerror',lambda e:r['errors'].append({'t':now(),'message':str(e)}))
    page.on('response',lambda x:r['responses'].append({'t':now(),'url':x.url,'status':x.status}))
    try:
        await page.goto(URL,wait_until='domcontentloaded',timeout=60000)
        for sec in [8,28,36]:
            await page.wait_for_timeout(max(0,sec-now())*1000)
            snap=await page.evaluate('''() => {
              const n=window.__GRIDATLAS_NEON_LINKS__,m=window.__GRIDATLAS_V9_MAP__;
              let rendered=0,sourceFeatures=0,layers=[];
              try {
                layers=(m.getStyle()?.layers||[]).filter(l=>/neon/.test(l.id));
                for(const l of layers) sourceFeatures=Math.max(sourceFeatures,m.getSource(l.source)?._data?.features?.length||0);
                rendered=layers.length?m.queryRenderedFeatures({layers:layers.map(l=>l.id)}).length:0;
              }catch(e){}
              return {installed:n?.installed,substations:n?.substations_loaded,links:n?.links_drawn,engine:n?.arrival_engine,status:n?.status_message,identity:n?.identity_verification,sourceFeatures,rendered,layerIds:layers.map(l=>l.id),text:document.body.innerText.slice(-900)};
            }''')
            snap['t']=now();r['snapshots'].append(snap)
            if sec in [8,28]:await page.screenshot(path=str(OUT/(name+'-'+str(sec)+'s.png')))
        r['diagnostics']=await page.evaluate('window.__LOAD_DIAG__')
        r['final_text']=await page.locator('body').inner_text()
    except Exception as e:r['harness_error']=str(e)
    (OUT/(name+'.json')).write_text(json.dumps(r,indent=2));print(json.dumps({k:v for k,v in r.items() if k not in ['diagnostics','responses','final_text']}),flush=True)
    await context.close()

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True,executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        (OUT/'environment.json').write_text(json.dumps({'browser':b.version,'url':URL,'scope':'Network hold only; all response bytes and application code remain unchanged; control uses identical route interception'},indent=2))
        for name,pattern in [('control',None),('delay-neso',r'/neso-connection-sites\.lean\.json'),('delay-identity',r'@duckdb/duckdb-wasm@1\.29\.0/\+esm'),('delay-substations',r'/data/grid_substations\.geojson')]:
            await test(b,name,pattern)
        await b.close()
asyncio.run(main())
