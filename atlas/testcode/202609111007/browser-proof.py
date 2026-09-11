"""Bounded Chrome checks on a candidate or the published Satellite survey test."""
import os, pathlib, json, re, shutil, time, sys
from playwright.sync_api import sync_playwright
HERE=pathlib.Path(__file__).resolve().parent
OUT=pathlib.Path('evidence'); OUT.mkdir(exist_ok=True)
ROOT='https://ventusltd.github.io/gridatlas/atlas/'
URL=ROOT+'testcode/202609111007/'
LIVE=os.environ.get('LIVE_TEST')=='1'
report={'url':URL,'live':LIVE,'checks':[],'errors':[],'imagery_http_errors':[],'stac_queries':[],'images':{}}
def check(name, ok, detail=None):
 report['checks'].append({'name':name,'pass':bool(ok),'detail':detail}); print(name, 'PASS' if ok else 'FAIL', flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':393,'height':740},is_mobile=True,has_touch=True,device_scale_factor=1)
 page=context.new_page()
 if not LIVE:
  for name, mime in [('index.html','text/html'),('satellite.js','text/javascript')]:
   data=(HERE/name).read_text()
   route_url=URL+'**' if name=='index.html' else URL+name+'*'
   def handler(route, request=None, *, data=data,mime=mime,name=name):
    clean=route.request.url.split('?')[0]
    if clean in [URL,URL+name]: route.fulfill(body=data,content_type=mime)
    else: route.continue_()
   page.route(route_url,handler)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 def response(r):
  if 'planetarycomputer.microsoft.com/api/data/' in r.url or '/World_Imagery/' in r.url:
   source='S2' if 'planetarycomputer' in r.url else 'Esri'
   report['images'][source]=report['images'].get(source,0)+(1 if r.ok else 0)
   if r.status>=400: report['imagery_http_errors'].append({'url':r.url,'status':r.status})
 page.on('response',response)
 def req(r):
  if '/api/stac/v1/search' in r.url:
   try: report['stac_queries'].append(json.loads(r.post_data or '{}'))
   except Exception: pass
 page.on('request',req)
 def state(): return page.evaluate('() => window.__GRIDATLAS_SATELLITE_TEST__.snapshot()')
 def snap(name):
  page.screenshot(path=str(OUT/(name+'.png')),full_page=False); report[name]=state()
 def grid(opened=True):
  b=page.locator('#gridatlas-menu-bar-title-4')
  isopen=b.evaluate("e=>e.closest('.gm-menu').classList.contains('gm-open')")
  if isopen!=opened: b.click()
 def satellite(opened=True):
  grid(True); d=page.locator('#satellite-survey')
  if d.evaluate('e=>e.open')!=opened: d.locator(':scope > summary').click()
 def visible_quick():
  return page.evaluate('''()=>[...document.querySelectorAll('button')].filter(e=>!e.closest('#gridatlas-menu-bar')&&/⚡\\s*grid|[◉◎]\\s*subs/i.test(e.textContent)).map(e=>{const r=e.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {text:e.textContent,parent:e.parentElement.id,rect:{x:r.x,y:r.y,w:r.width,h:r.height},hittable:top===e||e.contains(top)}})''')
 def toggle_quick(label,layer):
  grid(False); loc=page.get_by_role('button',name=re.compile(label))
  old=page.evaluate('(id)=>window.__GRIDATLAS_V9_MAP__.getLayoutProperty(id,"visibility")',layer)
  loc.click(timeout=8000); page.wait_for_timeout(150)
  mid=page.evaluate('(id)=>window.__GRIDATLAS_V9_MAP__.getLayoutProperty(id,"visibility")',layer)
  loc.click(timeout=8000); page.wait_for_timeout(150)
  end=page.evaluate('(id)=>window.__GRIDATLAS_V9_MAP__.getLayoutProperty(id,"visibility")',layer)
  check('Original '+layer+' toggle/restore',old!=mid and old==end,[old,mid,end])
 try:
  page.goto(URL,wait_until='domcontentloaded',timeout=60000)
  page.wait_for_selector('#satellite-survey',state='attached',timeout=60000)
  page.wait_for_timeout(5000)
  check('No floating satellite dock',page.locator('#sat-test-panel').count()==0)
  check('Satellite section inside Grid',state()['menuOnly'])
  check('Satellite buttons hidden on initial screen',not page.locator('#sat-test-s2').is_visible())
  report['quick_initial']=visible_quick();check('GRID/SUBS present and clickable',len(report['quick_initial'])==2 and all(x['hittable'] for x in report['quick_initial']))
  snap('main-screen')
  grid(True); check('Grid dropdown does not automatically expand survey',not page.locator('#sat-test-s2').is_visible())
  satellite(True);check('S2 reachable inside Grid',page.locator('#sat-test-s2').is_visible());snap('grid-survey-menu')
  grid(False)
  page.locator('#search-input').fill('Botley')
  page.wait_for_timeout(2500)
  check('Search has no satellite obstruction',not page.locator('#sat-test-s2').is_visible())
  snap('search-results')
  page.locator('#search-input').press('Escape');page.locator('#search-input').fill('')
  # Generic geometry for layout tests; use the public polygon fixture when present.
  fixture=HERE/'EN010101-boundary.geojson'
  if fixture.exists(): data=fixture.read_bytes(); name=fixture.name
  else:
   data=json.dumps({'type':'Polygon','coordinates':[[[-.593475,53.569066],[-.559087,53.569066],[-.559087,53.585988],[-.593475,53.585988],[-.593475,53.569066]]]}).encode();name='survey-test-boundary.geojson'
  satellite(True)
  page.locator('#survey-file').set_input_files({'name':name,'mimeType':'application/geo+json','buffer':data})
  page.wait_for_function('window.__GRIDATLAS_SATELLITE_TEST__.snapshot().boundary !== null')
  check('Boundary parsed and drawn',page.evaluate('()=>!!window.__GRIDATLAS_V9_MAP__.getLayer("survey-boundary-line")'))
  check('No status inferred from boundary',state()['boundary']['name']==name)
  page.locator('#satellite-survey details').filter(has=page.locator('#survey-file')).evaluate('e=>e.open=true')
  page.locator('#survey-fit').click();page.wait_for_timeout(400)
  toggle_quick(r'^⚡\s*Grid$','l-400');toggle_quick(r'^[◉◎]\s*Subs$','l-subs')
  satellite(True);page.locator('#sat-test-esri').click();page.locator('#survey-view').click();page.wait_for_timeout(4000)
  check('Esri selected',state()['mode']=='esri');snap('boundary-esri')
  satellite(True);t=time.monotonic();page.locator('#sat-test-s2').click();page.locator('#survey-view').click()
  page.wait_for_function('window.__GRIDATLAS_SATELLITE_TEST__.snapshot().mode==="s2"',timeout=60000)
  report['s2_first_seconds']=round(time.monotonic()-t,2);page.wait_for_timeout(1200)
  check('Boundary query sent as polygon',any(q.get('intersects',{}).get('type')=='MultiPolygon' for q in report['stac_queries']))
  check('Real S2 pixels returned',report['images'].get('S2',0)>0);snap('boundary-sentinel')
  toggle_quick(r'^⚡\s*Grid$','l-400');toggle_quick(r'^[◉◎]\s*Subs$','l-subs')
  first=state()['scene'];satellite(True)
  page.locator('#satellite-survey details').filter(has=page.locator('#survey-set-A')).evaluate('e=>e.open=true')
  page.locator('#survey-set-A').click()
  options=page.locator('#sat-scene option').evaluate_all('es=>es.map(e=>({value:e.value,text:e.textContent}))')
  first_date=state()['date'][:10];other=next((o for o in options if not o['text'].startswith(first_date)),None)
  check('Multiple dated captures available',other is not None)
  if other:
   page.locator('#sat-scene').select_option(other['value']);grid(False)
   page.wait_for_function('(id)=>window.__GRIDATLAS_SATELLITE_TEST__.snapshot().scene===id',arg=other['value'],timeout=60000)
   snap('second-capture');satellite(True);page.locator('#survey-set-B').click();page.locator('#survey-show-A').click();grid(False)
   page.wait_for_function('(id)=>window.__GRIDATLAS_SATELLITE_TEST__.snapshot().scene===id',arg=first,timeout=60000)
   check('A restores actual first image',state()['scene']==first);satellite(True);page.locator('#survey-show-B').click();grid(False)
   page.wait_for_function('(id)=>window.__GRIDATLAS_SATELLITE_TEST__.snapshot().scene===id',arg=other['value'],timeout=60000)
   check('B restores actual second image',state()['scene']==other['value']);satellite(True);snap('capture-dates');grid(False)
  for title,size in [('landscape',{'width':852,'height':393}),('desktop',{'width':1440,'height':900})]:
   page.set_viewport_size(size);page.wait_for_timeout(500)
   check(title+' satellite hidden at rest',not page.locator('#sat-test-s2').is_visible())
   check(title+' native buttons remain',state()['nativeNodesUnmoved']);snap(title)
   satellite(True);check(title+' menu S2 reachable',page.locator('#sat-test-s2').is_visible());grid(False)
  check('No uncaught JavaScript errors',not report['errors'],report['errors'])
  check('No imagery HTTP errors',not report['imagery_http_errors'],report['imagery_http_errors'])
 except Exception as e:
  check('Browser journey completed',False,str(e))
  try:page.screenshot(path=str(OUT/'failure.png'));(OUT/'failure.html').write_text(page.content())
  except Exception:pass
 finally:
  report['success']=all(c['pass'] for c in report['checks']);(OUT/'report.json').write_text(json.dumps(report,indent=2))
  print(json.dumps({'success':report['success'],'checks':len(report['checks']),'errors':report['errors'],'images':report['images'],'failed':[c for c in report['checks'] if not c['pass']]}),flush=True)
  browser.close()
sys.exit(0 if report['success'] else 1)
