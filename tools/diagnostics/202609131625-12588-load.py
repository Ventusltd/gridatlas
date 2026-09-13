"""Read-only headless latency diagnostics against the actual published Atlas.
All timelines are seconds from navigation. Chromium emulation is not an iPhone.
No production responses are substituted in baseline runs.
"""
import asyncio, hashlib, json, os, pathlib, re, shutil, time
from datetime import datetime, timezone
from playwright.async_api import async_playwright

OUT = pathlib.Path('latency-evidence'); OUT.mkdir(exist_ok=True)
URL = 'https://ventusltd.github.io/gridatlas/atlas/?repd_ref=12588&technology=solar&latitude=51.8132088&longitude=-1.3489728&zoom=12'
INIT = r'''(() => {
  const d = window.__LOAD_DIAG__ = {changes:[],longtasks:[],started:performance.now()};
  function small(o,depth=0) {
    if(o==null || ['string','number','boolean'].includes(typeof o)) return typeof o==='string'?o.slice(0,500):o;
    if(typeof o==='function') return '[function]';
    if(depth>2) return '[object]';
    if(Array.isArray(o)) return {length:o.length,first:o.slice(0,5).map(v=>small(v,depth+1))};
    const r={}; for(const k of Object.keys(o).slice(0,100)) {
      if(['map','features','payload','data','rows','entries','db','worker','conn','connection','_listeners','_eventedParent','measure'].includes(k)) continue;
      try {r[k]=small(o[k],depth+1);}catch(e){}
    } return r;
  }
  let last='';
  setInterval(()=>{
    const m=window.__GRIDATLAS_V9_MAP__, n=window.__GRIDATLAS_NEON_LINKS__;
    const globals={};
    for(const k of Object.keys(window).filter(k=>/^__GRIDATLAS_|^__REPD_/.test(k))) {
      if(k==='__GRIDATLAS_V9_MAP__'||k==='__GRIDATLAS_MODULES__') continue;
      try {globals[k]=small(window[k]);}catch(e){}
    }
    let map=null;
    try {if(m){const style=m.getStyle();map={styleLoaded:m.isStyleLoaded(),loaded:m.loaded(),center:m.getCenter(),zoom:m.getZoom(),sources:Object.keys(style?.sources||{}),lines:(style?.layers||[]).filter(l=>/neon|link|arrival|declared|pin/.test(l.id)).map(l=>({id:l.id,source:l.source,visibility:l.layout?.visibility,features:m.getSource(l.source)?._data?.features?.length})),attrs:{...m.getContainer().dataset}};}}catch(e){}
    const popups=[...document.querySelectorAll('.maplibregl-popup-content')].map(e=>e.textContent.slice(0,1100));
    const s={globals,map,popups,visibility:document.visibilityState};
    const text=JSON.stringify(s);if(text!==last){d.changes.push({t:performance.now()/1000,...s});last=text;}
  },250);
  try {new PerformanceObserver(l=>{for(const e of l.getEntries()) d.longtasks.push({t:e.startTime/1000,ms:e.duration});}).observe({type:'longtask',buffered:true});}catch(e){}
})();'''

async def visit(browser, name, context=None, slow=False, duration=60):
    own=context is None
    if own: context=await browser.new_context(viewport={'width':393,'height':852},is_mobile=True,has_touch=True,device_scale_factor=1)
    await context.add_init_script(INIT)
    page=await context.new_page(); start=time.monotonic()
    record={'name':name,'url':URL,'slow':slow,'requests':{},'console':[],'errors':[],'failures':[]}
    cdp=await context.new_cdp_session(page);await cdp.send('Network.enable')
    if slow:
        await cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':150,'downloadThroughput':500000,'uploadThroughput':125000,'connectionType':'cellular4g'})
        await cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
    def elapsed():return round(time.monotonic()-start,3)
    def request(p):
        record['requests'][p['requestId']]={'url':p['request']['url'],'start':elapsed(),'method':p['request']['method'],'type':p.get('type'),'initiator':p.get('initiator')}
    def response(p):
        r=record['requests'].setdefault(p['requestId'],{});v=p['response'];r.update(headers_at=elapsed(),status=v['status'],mime=v.get('mimeType'),cache=v.get('fromDiskCache'),serviceworker=v.get('fromServiceWorker'),timing=v.get('timing'))
    def data(p):
        r=record['requests'].setdefault(p['requestId'],{});r.setdefault('first_data',elapsed());r['last_data']=elapsed();r['decoded_bytes']=r.get('decoded_bytes',0)+p.get('dataLength',0)
    def finished(p):
        r=record['requests'].setdefault(p['requestId'],{});r.update(end=elapsed(),encoded_bytes=p.get('encodedDataLength'))
    def failed(p):
        r=record['requests'].setdefault(p['requestId'],{});r.update(end=elapsed(),error=p.get('errorText'));record['failures'].append(r.copy())
    cdp.on('Network.requestWillBeSent',request);cdp.on('Network.responseReceived',response);cdp.on('Network.dataReceived',data);cdp.on('Network.loadingFinished',finished);cdp.on('Network.loadingFailed',failed)
    page.on('pageerror',lambda e:record['errors'].append({'t':elapsed(),'message':str(e)}))
    page.on('console',lambda m:record['console'].append({'t':elapsed(),'type':m.type,'text':m.text[:1200]}) if m.type in ('warning','error') else None)
    try:
        await page.goto(URL,wait_until='domcontentloaded',timeout=90000)
        record['domcontentloaded']=elapsed()
        await page.wait_for_timeout(max(0,duration-elapsed())*1000)
        record['diagnostics']=await page.evaluate('window.__LOAD_DIAG__ || {}')
        record['final_text']=(await page.locator('body').inner_text())[:22000]
        record['resources']=await page.evaluate("performance.getEntriesByType('resource').map(e=>({url:e.name,start:e.startTime/1000,end:e.responseEnd/1000,duration:e.duration/1000,transfer:e.transferSize,encoded:e.encodedBodySize,decoded:e.decodedBodySize,initiator:e.initiatorType}))")
        await page.screenshot(path=str(OUT/(name+'.png')),timeout=10000)
    except Exception as e:record['harness_error']=str(e)
    record['elapsed']=elapsed();(OUT/(name+'.json')).write_text(json.dumps(record,indent=2))
    summary={'name':name,'elapsed':record['elapsed'],'errors':record['errors'],'pending':[(r.get('url'),r.get('start')) for r in record['requests'].values() if 'end' not in r],'last':record.get('diagnostics',{}).get('changes',[])[-1:]}
    (OUT/(name+'-summary.json')).write_text(json.dumps(summary,indent=2));print(json.dumps(summary),flush=True)
    await page.close()
    return context

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        (OUT/'environment.json').write_text(json.dumps({'utc':datetime.now(timezone.utc).isoformat(),'browser':browser.version,'url':URL,'method':'Actual published URL; no response interception; 393x852 touch emulation; slow lane 4 Mbps +150ms latency, CPU 4x throttle'},indent=2))
        ctx=await visit(browser,'cold-1',duration=60)
        await visit(browser,'warm-1',context=ctx,duration=35);await ctx.close()
        ctx=await visit(browser,'cold-2',duration=60);await ctx.close()
        ctx=await visit(browser,'slow-cold',slow=True,duration=120);await ctx.close()
        await browser.close()
    # Read source copies after browser timing, not during it. All files stay in evidence.
    import urllib.request
    root='https://ventusltd.github.io/gridatlas/atlas/'
    current=json.load(urllib.request.urlopen(root+'current.json',timeout=30));(OUT/'served-current.json').write_text(json.dumps(current,indent=2))
    source_dir=OUT/'served-source';source_dir.mkdir(exist_ok=True)
    proofs=[]
    from urllib.parse import urljoin
    for c in current['cartridges']:
        url=urljoin(root,c['path']);b=urllib.request.urlopen(url,timeout=45).read();actual=hashlib.sha256(b).hexdigest()
        (source_dir/pathlib.Path(c['path']).name).write_bytes(b)
        proofs.append({'id':c['id'],'url':url,'sha256':actual,'expected':c['sha256'],'match':actual==c['sha256'],'bytes':len(b)})
    (OUT/'served-byte-verification.json').write_text(json.dumps(proofs,indent=2))
    print('SOURCE_HASHES',json.dumps(proofs),flush=True)

asyncio.run(main())
