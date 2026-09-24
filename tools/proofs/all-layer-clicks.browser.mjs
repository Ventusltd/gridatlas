/** Drive every real Grid control and verify paint, feature picking and off-state. */
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
const arg=(key,fallback)=>process.argv.includes(key)?process.argv[process.argv.indexOf(key)+1]:fallback;
const root=path.resolve(import.meta.dirname,'../..');
const out=path.resolve(arg('--out',path.join(root,'work/layer-clicks')));
fs.mkdirSync(out,{recursive:true});
let server;
let url=arg('--url','');
if(!url){
 server=createServer((req,res)=>{
  try{
   let p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
   if(!p.startsWith(root+path.sep))throw Error('outside root');
   if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');
   res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.geojson':'application/geo+json','.css':'text/css','.wasm':'application/wasm'})[path.extname(p)]||'application/octet-stream');
   res.setHeader('cache-control','no-store');res.end(fs.readFileSync(p));
  }catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/atlas/`;
}
const width=Number(arg('--width','1440'));
const browser=await chromium.launch({channel:arg('--channel',process.platform==='win32'?'chrome':undefined),headless:true});
const results=[];
const requested=arg('--ids','');
let ids=requested?requested.split(','):null;
async function open(){
 const context=await browser.newContext({viewport:{width,height:width<700?852:1000},hasTouch:width<700,isMobile:width<700,...(width<700?{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'}:{})});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>document.querySelectorAll('[data-gridatlas-layer-proxy]').length>=60&&window.__GRIDATLAS_V9_MAP__,null,{timeout:60000});
 return {context,page};
}
try{
 if(!ids){const {context,page}=await open();ids=await page.locator('#scada-ui-container input[data-layer-id]').evaluateAll(xs=>xs.map(x=>x.dataset.layerId));await context.close();}
 for(const id of ids){
  const r={id};let context,page;
  try{
   ({context,page}=await open());r.errors=[];page.on('pageerror',e=>r.errors.push(String(e)));
   r.generation=await page.evaluate(()=>window.__GRIDATLAS_ATLAS__.generation);
   const proxy=page.locator(`[data-gridatlas-layer-proxy="engine:${id}"]`),grid=page.getByRole('button',{name:'Grid',exact:true});
   await grid.click();await proxy.scrollIntoViewIfNeeded();
   r.initialLabel=await proxy.getAttribute('aria-label');
   await proxy.click();
   await page.waitForFunction(id=>/\[(OK|EMPTY|FAIL|\d)/.test(document.getElementById('lbl-'+id)?.textContent||''),id,{timeout:60000,polling:200});
   r.label=await proxy.getAttribute('aria-label');r.checked=await proxy.isChecked();r.disabled=await proxy.isDisabled();
   await page.screenshot({path:path.join(out,`${id}-control.png`)});
   await grid.click();
   const source=await page.evaluate(async id=>{
    const m=window.__GRIDATLAS_V9_MAP__,layer=m.getStyle().layers.find(x=>x.id==='l-'+id);let data=m.getSource(layer.source)._data;
    if(typeof data==='string')data=await(await fetch(new URL(data,document.baseURI))).json();
    function value(e,f){if(!Array.isArray(e))return e;const [op,...a]=e;if(op==='get')return f.properties?.[a[0]];if(op==='literal')return a[0];if(op==='coalesce')return a.map(x=>value(x,f)).find(x=>x!=null);if(op==='to-number')return Number(value(a[0],f));if(op==='all')return a.every(x=>value(x,f));if(op==='any')return a.some(x=>value(x,f));if(op==='!')return !value(a[0],f);if(op==='==')return value(a[0],f)===value(a[1],f);if(op==='!=')return value(a[0],f)!==value(a[1],f);if(op==='>=')return value(a[0],f)>=value(a[1],f);if(op==='in')return value(a[1],f)?.includes(value(a[0],f))||false;throw Error('unsupported filter '+op);}
    const eligible=(data.features||[]).filter(f=>(layer.type==='circle'?['Point','MultiPoint']:['LineString','MultiLineString']).includes(f.geometry?.type)&&(!layer.filter||value(layer.filter,f)));
    function point(g){let c=g.coordinates;while(Array.isArray(c[0]))c=c[Math.floor(c.length/2)];return c;}
    const sample=eligible.find(f=>{const c=point(f.geometry);return c[0]>-8&&c[0]<2&&c[1]>50&&c[1]<59;})||eligible[0];
    const target=sample?point(sample.geometry):null;
    if(target)m.jumpTo({center:target,zoom:Math.max(layer.minzoom||0,layer.type==='line'?10:9)+.5});
    return {layer,featureCount:data.features?.length,eligible:eligible.length,target,sample:sample?{id:sample.id,properties:sample.properties}:null};
   },id);
   Object.assign(r,source);
   if(source.eligible&&r.checked&&!r.disabled){
    await page.waitForFunction(id=>{const m=window.__GRIDATLAS_V9_MAP__,l=m.getLayer('l-'+id);return m.isSourceLoaded(l.source)&&m.queryRenderedFeatures({layers:['l-'+id]}).length>0;},id,{timeout:30000});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    r.rendered=await page.evaluate(id=>window.__GRIDATLAS_V9_MAP__.queryRenderedFeatures({layers:['l-'+id]}).length,id);
    await page.screenshot({path:path.join(out,`${id}-map.png`)});
    const hit=await page.evaluate(target=>{const m=window.__GRIDATLAS_V9_MAP__,p=m.project(target),b=m.getCanvas().getBoundingClientRect();return {x:b.left+p.x,y:b.top+p.y};},source.target);
    if(width<700)await page.touchscreen.tap(hit.x,hit.y);else await page.mouse.click(hit.x,hit.y);
    await page.waitForTimeout(250);
    r.popup=await page.locator('.maplibregl-popup').count();
    r.popupText=r.popup?await page.locator('.maplibregl-popup').allTextContents():[];
    await page.screenshot({path:path.join(out,`${id}-picked.png`)});
    // Close any card through its real close button before testing the off switch.
    for(const popup of await page.locator('.maplibregl-popup').all()){
     const custom=popup.locator('.gridatlas-card-bar .close');
     const close=await custom.count()?custom:popup.locator('.maplibregl-popup-close-button');
     const box=await close.boundingBox();
     if(!box||box.x<0||box.y<0||box.x+box.width>width||box.y+box.height>(width<700?852:1000))throw Error('card close control is clipped by the viewport');
     if(width<700)await close.tap();else await close.click();
    }
    await grid.click();await proxy.scrollIntoViewIfNeeded();await proxy.click();
    r.off=!(await proxy.isChecked())&&await page.evaluate(id=>window.__GRIDATLAS_V9_MAP__.getLayoutProperty('l-'+id,'visibility')==='none',id);
   }
   r.pass=!!(r.checked&&!r.disabled&&r.eligible>0&&r.rendered>0&&r.popup>0&&r.off&&r.errors.length===0);
  }catch(e){r.error=String(e);r.pass=false;}
  finally{if(context)await context.close();}
  results.push(r);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({url,width,results},null,2));
  console.log(JSON.stringify({id:r.id,label:r.label,eligible:r.eligible,rendered:r.rendered,popup:r.popup,off:r.off,pass:r.pass,error:r.error}));
 }
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
if(results.some(r=>!r.pass))process.exitCode=1;
