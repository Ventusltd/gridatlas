"""Browser regression checks; real production cartridges and external tile services.
Candidate loader/add-on are intercepted only when PROBE_SHA is supplied.
No data, tiles or other production assets are mocked.
"""
import json, os, pathlib, re, shutil, sys, time
import requests
from playwright.sync_api import sync_playwright
OUT = pathlib.Path('evidence'); OUT.mkdir(exist_ok=True)
BASE = 'https://ventusltd.github.io/gridatlas/atlas/'
PATH = 'atlas/testcode/202609110242/'
TARGET = BASE + 'testcode/202609110242/'
SHA = os.environ.get('PROBE_SHA')
report = {'candidate_sha': SHA, 'target': TARGET, 'checks': [], 'page_errors': [], 'http_errors': [], 'images': {}}

def check(name, condition, details=None):
    report['checks'].append({'name': name, 'pass': bool(condition), 'details': details})
    print(name, 'PASS' if condition else 'FAIL', json.dumps(details, ensure_ascii=False), flush=True)

def state(page):
    return page.evaluate("""() => {
      const map=window.__GRIDATLAS_V9_MAP__, panel=document.getElementById('sat-test-panel');
      const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
      const buttons=[...document.querySelectorAll('button')].filter(e=>['⚡ Grid','◉ Subs','▴ LAYERS','▾ LAYERS'].includes(e.textContent.trim())||e.id.startsWith('sat-test-'));
      return {state:window.__GRIDATLAS_SATELLITE_TEST__?.snapshot(), status:document.getElementById('sat-test-status')?.textContent, panel:rect(panel), compact:panel.dataset.compact, hidden:panel.hidden,
        controls:buttons.map(e=>({id:e.id,text:e.textContent.trim(),rect:rect(e),hittable:(()=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit)})()})),
        layers:map.getStyle().layers.filter(l=>['l-sat','l-subs','l-400','l-neon-core','l-project-pin'].includes(l.id)||l.id.startsWith('sat-test')).map(l=>({id:l.id,type:l.type,visibility:l.layout?.visibility,index:map.getStyle().layers.findIndex(k=>k.id===l.id)})),
        sources:Object.fromEntries(Object.entries(map.getStyle().sources).filter(([k])=>k.startsWith('sat-test'))),
        composition:window.__GRIDATLAS_ATLAS__, view:{centre:map.getCenter(),zoom:map.getZoom()}};
    }""")

def snapshot(page, name):
    data=state(page); report[name]=data
    page.screenshot(path=str(OUT/(name+'.png')), animations='disabled')
    print('STATE',name,json.dumps(data,ensure_ascii=False),flush=True)
    if not data['hidden']:
        p=data['panel']
        for e in data['controls']:
            if e['id'].startswith('sat-test-'): check(name+' touch target '+e['id'],e['rect']['height']>=44)
            else:
                r=e['rect']; overlap=p['x']<r['x']+r['width'] and p['x']+p['width']>r['x'] and p['y']<r['y']+r['height'] and p['y']+p['height']>r['y']
                check(name+' no satellite overlap '+e['text'],not overlap)
                if e['id']!='gridatlas-dash-toggle': check(name+' hittable '+e['text'],e['hittable'])
    return data

with sync_playwright() as p:
    launch={'headless':True,'args':['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']}
    if shutil.which('google-chrome'): launch['executable_path']=shutil.which('google-chrome')
    browser=p.chromium.launch(**launch)
    context=browser.new_context(viewport={'width':393,'height':852},device_scale_factor=1,is_mobile=True,has_touch=True)
    page=context.new_page()
    page.on('pageerror',lambda e:report['page_errors'].append(str(e)))
    def response(r):
        if r.status>=400: report['http_errors'].append({'status':r.status,'url':r.url})
        if 'World_Imagery/MapServer/tile/' in r.url or '/api/data/v1/item/tiles/' in r.url:
            key='Esri' if 'World_Imagery' in r.url else 'S2'
            d=report['images'].setdefault(key,{'ok':0,'errors':0});d['ok' if r.ok else 'errors']+=1
    page.on('response',response)
    if SHA:
        raw='https://raw.githubusercontent.com/Ventusltd/gridatlas/'+SHA+'/'
        files={name:requests.get(raw+PATH+name,timeout=30) for name in ['index.html','satellite.js']}
        for r in files.values(): r.raise_for_status()
        page.route(TARGET+'**',lambda route:route.fulfill(body=files['index.html'].text,content_type='text/html') if route.request.url.split('?')[0] in [TARGET,TARGET+'index.html'] else route.continue_())
        page.route(TARGET+'satellite.js*',lambda route:route.fulfill(body=files['satellite.js'].text,content_type='text/javascript'))
    try:
        baseline=context.new_page()
        baseline.goto(BASE+'?repd_ref=9873&technology=wind_offshore&latitude=56.4431397&longitude=-1.4664021&zoom=12',wait_until='domcontentloaded',timeout=60000)
        baseline.get_by_role('button',name='◉ Subs',exact=True).wait_for(timeout=60000)
        baseline.wait_for_timeout(2000)
        report['production_baseline']=baseline.evaluate("""() => [...document.querySelectorAll('button')].filter(e=>e.id==='gridatlas-dash-toggle'||['⚡ Grid','◉ Subs'].includes(e.textContent.trim())).map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:e.id,text:e.textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height},hittable:hit===e||e.contains(hit),intercepted_by:hit?.outerHTML.slice(0,200)}})""")
        baseline.screenshot(path=str(OUT/'unchanged-production.png'))
        baseline.close()
        page.goto(TARGET+'?repd_ref=9873&technology=wind_offshore&latitude=56.4431397&longitude=-1.4664021&zoom=12',wait_until='domcontentloaded',timeout=60000)
        page.wait_for_selector('#sat-test-panel',timeout=60000)
        page.wait_for_timeout(10000)
        before=snapshot(page,'portrait-dark')
        def toggle_features(label):
            for text, layer in [('⚡ Grid','l-400'),('◉ Subs','l-subs')]:
                button=page.get_by_role('button',name=text,exact=True)
                if button.get_attribute('aria-pressed')!='true':
                    button.click(timeout=5000);page.wait_for_timeout(100)
                initial=page.evaluate('(id)=>window.__GRIDATLAS_V9_MAP__.getLayoutProperty(id,"visibility")',layer)
                button.click(timeout=5000);page.wait_for_timeout(100)
                changed=page.evaluate('(id)=>window.__GRIDATLAS_V9_MAP__.getLayoutProperty(id,"visibility")',layer)
                button.click(timeout=5000);page.wait_for_timeout(100)
                restored=page.evaluate('(id)=>window.__GRIDATLAS_V9_MAP__.getLayoutProperty(id,"visibility")',layer)
                check(label+' '+text+' toggle/restore',initial!=changed and initial==restored,[initial,changed,restored])
        toggle_features('dark')
        page.locator('#sat-test-esri').click();page.wait_for_timeout(3000)
        esri=snapshot(page,'portrait-esri');toggle_features('esri')
        check('imagery switching retains view',abs(esri['view']['zoom']-before['view']['zoom'])<0.001)
        start=time.monotonic();page.locator('#sat-test-s2').click()
        try:
            page.wait_for_function('window.__GRIDATLAS_SATELLITE_TEST__?.snapshot().mode === "s2"',timeout=55000)
            report['first_s2_seconds']=round(time.monotonic()-start,2)
        except Exception as exc: check('S2 reaches ready',False,str(exc))
        page.wait_for_timeout(500)
        s2=snapshot(page,'portrait-sentinel');toggle_features('sentinel')
        check('S2 rendered tiles',s2['state']['mode']=='s2' and report['images'].get('S2',{}).get('ok',0)>0)
        layers={x['id']:x for x in s2['layers']}
        sat_indices=[x['index'] for x in s2['layers'] if x['id']=='l-sat' or x['id'].startswith('sat-test')]
        check('imagery below engineering overlays',bool(sat_indices) and all(max(sat_indices)<layers[id]['index'] for id in ['l-400','l-subs','l-neon-core','l-project-pin'] if id in layers))
        check('S2 bounds and native-resolution zoom cap',bool(s2['sources']) and all(s.get('bounds') and s.get('maxzoom')<=14 and s.get('minzoom')>=6 for s in s2['sources'].values()))
        page.locator('#sat-test-esri').click();page.wait_for_timeout(100)
        page.locator('#sat-test-s2').click();page.wait_for_timeout(200)
        cached=state(page)
        check('repeat S2 reuses source and catalogue',cached['state']['mode']=='s2' and cached['state']['sourceAdds']==s2['state']['sourceAdds'] and cached['state']['searches']==s2['state']['searches'])
        page.set_viewport_size({'width':852,'height':393});page.wait_for_timeout(800)
        snapshot(page,'landscape');toggle_features('landscape')
        page.set_viewport_size({'width':393,'height':852});page.wait_for_timeout(800)
        # Existing project card: expand, then minimise, without editing its code.
        minus=page.locator('.gridatlas-card-bar button').filter(has_text='−')
        if minus.count():
            minus.first.click();page.wait_for_timeout(500);snapshot(page,'project-card-open')
            minus.first.click();page.wait_for_timeout(500);snapshot(page,'project-card-minimised')
        # Use the unchanged top Grid menu. The bottom Layers button is already
        # behind the fullscreen canvas in baseline Chrome, recorded separately.
        page.locator('#gridatlas-menu-bar-title-4').click();page.wait_for_timeout(500);snapshot(page,'layers-open')
        check('native layer panel opens',page.locator('#gridatlas-menu-bar-panel-4').is_visible())
        page.locator('#gridatlas-menu-bar-title-4').click();page.wait_for_timeout(500)
        # Real new onshore query, then select Esri immediately. Late S2 must not win.
        page.locator('#sat-test-esri').click()
        page.evaluate('window.__GRIDATLAS_V9_MAP__.jumpTo({center:[-1.37,51.83],zoom:12})')
        page.wait_for_timeout(1000)
        page.locator('#sat-test-s2').click();page.locator('#sat-test-esri').click();page.wait_for_timeout(2000)
        check('last selection wins cancelled S2 request',state(page)['state']['mode']=='esri')
        page.locator('#sat-test-s2').click()
        page.wait_for_function('window.__GRIDATLAS_SATELLITE_TEST__?.snapshot().mode === "s2"',timeout=55000)
        page.wait_for_timeout(300);snapshot(page,'onshore-sentinel')
        # S2 off through the original native Dark control (not the new button).
        page.evaluate('''() => {const r=document.querySelector('input[name="bm"][value="dark"]');r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));}''')
        check('native Dark clears S2',state(page)['state']['mode']=='dark')
        page.set_viewport_size({'width':1440,'height':900});page.wait_for_timeout(700);snapshot(page,'desktop')
        check('no uncaught page errors',not report['page_errors'],report['page_errors'])
        check('four unchanged production cartridges',len(state(page)['composition']['loaded_cartridges'])==4)
    except Exception as exc:
        check('browser journey completed',False,str(exc))
        try:page.screenshot(path=str(OUT/'failure.png'));(OUT/'failure.html').write_text(page.content())
        except Exception:pass
    finally:
        report['success']=all(x['pass'] for x in report['checks'])
        (OUT/'report.json').write_text(json.dumps(report,indent=2))
        print('SUMMARY',json.dumps({'success':report['success'],'checks':len(report['checks']),'failed':[x for x in report['checks'] if not x['pass']],'images':report['images'],'first_s2_seconds':report.get('first_s2_seconds')}),flush=True)
        browser.close()
sys.exit(0 if report.get('success') else 1)
