"""Bounded real-browser proof. Never includes private commercial information."""
import argparse, hashlib, json, os, pathlib, shutil, time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
HERE=pathlib.Path(__file__).resolve().parent
OUT=pathlib.Path('evidence');OUT.mkdir(exist_ok=True)
ROOT='https://ventusltd.github.io/gridatlas/atlas/'
TARGET=ROOT+'testcode/202609110849/'
PUBLISHED=os.environ.get('PUBLISHED')=='true'
report={'target':TARGET,'published':PUBLISHED,'checks':[],'errors':[],'imagery_http':{'esri':[],'sentinel':[]},'states':{}}
def check(name,ok,detail=None):
 report['checks'].append({'name':name,'pass':bool(ok),'detail':detail});print('CHECK',name,'PASS' if ok else 'FAIL',flush=True)
def snap(page,name):
 page.screenshot(path=str(OUT/(name+'.png')))
 state=page.evaluate('''() => {const p=document.getElementById('sat-test-panel'),m=window.__GRIDATLAS_V9_MAP__;const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}; const buttons=p?[...p.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().height).map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:e.id,native:e.dataset.satNative,text:e.textContent,rect:rect(e),hittable:e===hit||e.contains(hit)}}):[]; return {state:window.__GRIDATLAS_SATELLITE_TEST__?.snapshot(),panel:p?rect(p):null,hidden:p?.hidden,status:document.getElementById('sat-test-status')?.textContent,buttons,view:{centre:m?.getCenter(),zoom:m?.getZoom()}}}''')
 report['states'][name]=state;return state

def layout(page,name):
 state=snap(page,name)
 check(name+' dock visible',state['panel'] and not state['hidden'])
 for b in state['buttons']:
  check(name+' hit '+(b['native'] or b['id']), b['hittable'] and b['rect']['height']>=44 and b['rect']['width']>=44)
 check(name+' same native GRID/SUBS nodes',state['state']['nativeNodesPreserved'])
 return state

def toggle(page,name):
 for target,layer in [('grid','l-400'),('subs','l-subs')]:
  get=lambda:page.evaluate('(id)=>window.__GRIDATLAS_V9_MAP__.getLayoutProperty(id,"visibility")',layer)
  a=get();page.locator('[data-sat-native='+target+']').click();page.wait_for_timeout(150);b=get();page.locator('[data-sat-native='+target+']').click();page.wait_for_timeout(150);c=get()
  check(name+' native '+target+' toggle and restore',a!=b and a==c,[a,b,c])

def state(page):return page.evaluate('window.__GRIDATLAS_SATELLITE_TEST__.snapshot()')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 ctx=browser.new_context(viewport={'width':393,'height':740},device_scale_factor=1,is_mobile=True,has_touch=True)
 page=ctx.new_page();page.set_default_timeout(10000)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 def response(r):
  if '/World_Imagery/' in r.url:report['imagery_http']['esri'].append(r.status)
  if 'planetarycomputer.microsoft.com/api/data/v1/item/tiles/' in r.url:report['imagery_http']['sentinel'].append(r.status)
 page.on('response',response)
 try:
  page.goto(ROOT+'testcode/202609110242/',wait_until='domcontentloaded',timeout=60000)
  page.wait_for_selector('#sat-test-panel',timeout=60000)
  page.screenshot(path=str(OUT/'before.png'))
  if not PUBLISHED:
   def local(route):
    name=urlparse(route.request.url).path.rstrip('/').split('/')[-1]
    if name=='202609110849':name='index.html'
    file=HERE/name
    if file.is_file() and name in ['index.html','satellite.js']:route.fulfill(body=file.read_bytes(),content_type='text/html' if name.endswith('html') else 'text/javascript')
    else:route.continue_()
   page.route(TARGET+'**',local)
  page.goto(TARGET,wait_until='domcontentloaded',timeout=60000)
  page.wait_for_selector('#sat-test-panel',timeout=60000)
  page.wait_for_timeout(1000)
  a=layout(page,'portrait-docked');toggle(page,'dark')
  check('dock defaults to lower half',a['panel']['top']>300)
  page.locator('#search-input').fill('Beacon Fen');page.locator('#search-input').press('Enter')
  page.wait_for_function('()=>document.getElementById("search-results")?.textContent.toLowerCase().includes("beacon")',timeout=40000)
  page.wait_for_timeout(800)
  overlap=page.evaluate('''()=>{const a=document.getElementById('sat-test-panel').getBoundingClientRect(),b=document.getElementById('search-results').getBoundingClientRect();return {listVisible:b.height>0,overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top}}''')
  check('real search results are visible and not covered',overlap['listVisible'] and not overlap['overlap'],overlap)
  snap(page,'search-clear')
  page.locator('#search-input').press('Escape');page.locator('#search-input').fill('');page.locator('#search-input').blur();page.wait_for_timeout(300)
  before=page.evaluate('()=>({r:document.getElementById("sat-test-panel").getBoundingClientRect().toJSON(),view:window.__GRIDATLAS_V9_MAP__.getCenter()})')
  handle=page.locator('#sat-drag').bounding_box();x=handle['x']+handle['width']/2;y=handle['y']+22
  cd=ctx.new_cdp_session(page)
  cd.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
  for i in range(1,7):cd.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-i*22}]});page.wait_for_timeout(35)
  cd.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(500)
  after=page.evaluate('()=>({r:document.getElementById("sat-test-panel").getBoundingClientRect().toJSON(),view:window.__GRIDATLAS_V9_MAP__.getCenter()})')
  check('real touch drag moves dock',abs(after['r']['y']-before['r']['y'])>50)
  check('drag does not pan map',before['view']==after['view'])
  layout(page,'dragged');page.locator('#sat-reset').click();page.wait_for_timeout(300)
  check('return arrow resets docking',not state(page)['dockMoved'])
  # Generic public onshore area, not a private project-status assertion.
  page.evaluate('window.__GRIDATLAS_V9_MAP__.jumpTo({center:[-1.3,51.8],zoom:12})');page.wait_for_timeout(800)
  beforeview=page.evaluate('()=>({c:window.__GRIDATLAS_V9_MAP__.getCenter(),z:window.__GRIDATLAS_V9_MAP__.getZoom()})')
  page.locator('#sat-test-esri').click();page.wait_for_timeout(2000)
  layout(page,'portrait-esri');toggle(page,'esri')
  started=time.monotonic();page.locator('#sat-test-s2').click()
  page.wait_for_function('()=>window.__GRIDATLAS_SATELLITE_TEST__?.snapshot().mode==="s2"',timeout=55000)
  report['first_sentinel_seconds']=round(time.monotonic()-started,2)
  layout(page,'portrait-sentinel');toggle(page,'sentinel')
  a=state(page);check('newest acquisition is default',a['policy']=='latest' and a['scene'] and a['scenes']>1)
  check('actual Sentinel tiles loaded',a['loadedTileEvents']>0)
  page.locator('#sat-scenes-toggle').click();page.wait_for_timeout(300)
  sceneoptions=page.locator('#sat-scene option').count();check('real acquisition dates listed',sceneoptions>1)
  latest=state(page)['date'];page.locator('#sat-policy').select_option('clear')
  page.wait_for_function('()=>window.__GRIDATLAS_SATELLITE_TEST__.snapshot().policy==="clear" && !document.getElementById("sat-test-status").textContent.match(/Finding|Loading/)',timeout=55000)
  chosen=state(page);check('cloud preference date no later than newest',chosen['date']<=latest)
  snap(page,'dated-scenes')
  options=page.locator('#sat-scene option').evaluate_all('(els)=>els.map(e=>e.value)')
  older=next((v for v in options if v!=chosen['scene']),None)
  if older:
   page.locator('#sat-scene').select_option(older)
   page.wait_for_function('(id)=>window.__GRIDATLAS_SATELLITE_TEST__.snapshot().scene===id',arg=older,timeout=55000)
   check('manual date actually changes imagery identity',state(page)['scene']==older)
  page.locator('#sat-scenes-toggle').click();page.wait_for_timeout(300)
  a=state(page);page.locator('#sat-test-esri').click();page.locator('#sat-test-s2').click();page.wait_for_timeout(300);b=state(page)
  check('switch back reuses source and catalogue',a['searches']==b['searches'] and a['sourceAdds']==b['sourceAdds'] and b['reused']>a['reused'])
  afterview=page.evaluate('()=>({c:window.__GRIDATLAS_V9_MAP__.getCenter(),z:window.__GRIDATLAS_V9_MAP__.getZoom()})')
  check('imagery changes preserve camera',beforeview==afterview)
  page.set_viewport_size({'width':852,'height':393});page.wait_for_timeout(800);layout(page,'landscape');toggle(page,'landscape')
  page.set_viewport_size({'width':1365,'height':768});page.wait_for_timeout(800);layout(page,'desktop')
  page.set_viewport_size({'width':393,'height':740});page.wait_for_timeout(500)
  page.locator('#sat-collapse').click();page.wait_for_timeout(200);check('collapse works',page.locator('#sat-test-esri').is_hidden());page.locator('#sat-collapse').click()
  page.locator('#gridatlas-menu-bar-title-4').click();page.wait_for_timeout(400)
  check('original top Grid menu works',page.locator('.gm-open .gm-panel').is_visible());snap(page,'grid-menu')
  page.locator('#gridatlas-menu-bar-title-4').click();page.wait_for_timeout(400);layout(page,'menu-closed')
  check('zero uncaught browser exceptions',not report['errors'],report['errors'])
  check('Esri returned image tiles',200 in report['imagery_http']['esri'])
  check('Sentinel returned image tiles',200 in report['imagery_http']['sentinel'])
 except Exception as e:
  check('browser journey completed',False,str(e))
  try:page.screenshot(path=str(OUT/'failure.png'));(OUT/'failure.html').write_text(page.content())
  except Exception:pass
 finally:
  report['success']=all(c['pass'] for c in report['checks']);(OUT/'report.json').write_text(json.dumps(report,indent=2))
  print('SUMMARY',json.dumps({'success':report['success'],'checks':len(report['checks']),'failed':[c for c in report['checks'] if not c['pass']],'first_sentinel_seconds':report.get('first_sentinel_seconds'),'imagery_statuses':{k:{s:v.count(s) for s in set(v)} for k,v in report['imagery_http'].items()}}),flush=True)
  browser.close()
raise SystemExit(0 if report['success'] else 1)
