import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const oracleUrl = process.env.ORACLE_URL || 'http://127.0.0.1:4174/';
const mirrorUrl = process.env.MIRROR_URL || 'https://ventusltd.github.io/gridatlas/202608291758-atlas-v9/';
const output = process.env.OUTPUT || 'work/202608291818-v8-mirror-proof.json';
const expected = Object.freeze({
  index: '278c3f55d3b61af9d13417c99bfb558374131143',
  css: '29a2edb490407f489c29433d84e329b1038e0657',
  engine: '0a647c32c346770851704727bbf86fb7167e2596',
  bridge: '<script src="v9-parquet-fetch-bridge.js"></script>\n\n'
});
const selectors = [
  '.dashboard','.hud-header','.map-container','.scada-wrapper','.scada-brand','.status-legend','.disclaimer-box',
  '#scada-ui-container','.search-bar-wrapper','.map-controls','#radius-popup','#radius-area-popup',
  '#zonedraw-display','#measure-display','#polyzone-display','#fs-curtain','#fs-letterhead',
  '#btn-fullscreen','#btn-fullscreen-exit'
];
const styles = [
  'display','position','font-family','font-size','font-weight','color','background-color',
  'border-top-width','border-right-width','border-bottom-width','border-left-width','border-radius',
  'padding-top','padding-right','padding-bottom','padding-left','gap','grid-template-columns',
  'flex-direction','overflow','z-index'
];
const pixelRegions = [
  { selector: '.hud-header', masks: ['#clock','#date','#days'] },
  { selector: '.search-bar-wrapper', masks: [] },
  { selector: '.map-controls', masks: [] },
  { selector: '.scada-brand', masks: [] },
  { selector: '.status-legend', masks: [] },
  { selector: '.disclaimer-box', masks: [] }
];

const requireCondition = (ok, message) => { if (!ok) throw new Error(message); };
const blob = bytes => crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
async function bytes(url) {
  const r = await fetch(url, { cache: 'no-store' });
  requireCondition(r.ok, `${url} HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function byteProof() {
  const [oi,oc,oe,mi,mc,me] = await Promise.all([
    bytes(new URL('index.html', oracleUrl)), bytes(new URL('ventusv8.css', oracleUrl)),
    bytes(new URL('ventus-corev8engine.js', oracleUrl)), bytes(new URL('index.html', mirrorUrl)),
    bytes(new URL('ventusv8.css', mirrorUrl)), bytes(new URL('ventus-corev8engine.js', mirrorUrl))
  ]);
  requireCondition(blob(oi) === expected.index, 'V8 index blob mismatch');
  requireCondition(blob(oc) === expected.css, 'V8 CSS blob mismatch');
  requireCondition(blob(oe) === expected.engine, 'V8 engine blob mismatch');
  requireCondition(blob(mc) === expected.css, 'mirror CSS is not V8 byte-identical');
  requireCondition(blob(me) === expected.engine, 'mirror engine is not V8 byte-identical');
  const text = mi.toString('utf8');
  requireCondition(text.includes(expected.bridge), 'mirror bridge tag missing');
  const normalised = Buffer.from(text.replace(expected.bridge, ''), 'utf8');
  requireCondition(normalised.equals(oi) && blob(normalised) === expected.index, 'mirror HTML has an unapproved V8 delta');
  return { index_blob:expected.index, css_blob:expected.css, engine_blob:expected.engine,
    html_delta:'ONE_BRIDGE_SCRIPT_INSERTION_ONLY', css_byte_identical:true, engine_byte_identical:true };
}

async function ready(page) {
  await page.waitForSelector('.dashboard', { timeout:45000 });
  await page.waitForSelector('#scada-ui-container .key-item', { timeout:45000 });
  await page.waitForSelector('#map canvas', { timeout:45000 });
}

async function snapshot(page) {
  return page.evaluate(({ selectors, styles }) => {
    const round = n => Math.round(Number(n)*10)/10;
    const boxes = {}, computed = {};
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) { boxes[selector]=null; computed[selector]=null; continue; }
      const b = el.getBoundingClientRect(), c = getComputedStyle(el);
      boxes[selector] = { x:round(b.x), y:round(b.y), width:round(b.width), height:round(b.height) };
      computed[selector] = Object.fromEntries(styles.map(p => [p,c.getPropertyValue(p)]));
    }
    return {
      boxes, computed,
      controls:[...document.querySelectorAll('.map-ctrl-btn')].map(el=>({id:el.id,text:el.textContent.trim()})),
      groups:[...document.querySelectorAll('#scada-ui-container .key-title')].map(el=>el.textContent.trim()),
      labels:[...document.querySelectorAll('#scada-ui-container span[data-base-label]')].map(el=>({id:el.id,base:el.getAttribute('data-base-label'),color:getComputedStyle(el).color})),
      checkboxes:document.querySelectorAll('#scada-ui-container input[type="checkbox"]').length,
      radios:document.querySelectorAll('#scada-ui-container input[type="radio"]').length,
      placeholder:document.querySelector('#search-input')?.getAttribute('placeholder')||'',
      brand:document.querySelector('.ventus-main')?.textContent.trim()||'',
      disclaimer:document.querySelector('.disclaimer-box')?.textContent.trim()||''
    };
  }, { selectors, styles });
}

function compare(a,b,viewport) {
  const errors=[], same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
  for (const [name,x,y] of [
    ['controls',a.controls,b.controls],['groups',a.groups,b.groups],['labels/order/colours',a.labels,b.labels]
  ]) if (!same(x,y)) errors.push(`${viewport}: ${name} differ`);
  if (a.checkboxes!==b.checkboxes) errors.push(`${viewport}: checkbox count differs`);
  if (a.radios!==b.radios) errors.push(`${viewport}: radio count differs`);
  if (a.placeholder!==b.placeholder) errors.push(`${viewport}: search placeholder differs`);
  if (a.brand!==b.brand) errors.push(`${viewport}: brand differs`);
  if (a.disclaimer!==b.disclaimer) errors.push(`${viewport}: disclaimer differs`);
  for (const selector of selectors) {
    const x=a.boxes[selector], y=b.boxes[selector];
    if ((x===null)!==(y===null)) { errors.push(`${viewport}: presence differs ${selector}`); continue; }
    if (!x||!y) continue;
    for (const k of ['x','y','width','height']) if (Math.abs(x[k]-y[k])>1) errors.push(`${viewport}: ${selector} ${k} differs`);
    for (const p of styles) if (a.computed[selector]?.[p]!==b.computed[selector]?.[p]) errors.push(`${viewport}: ${selector} ${p} differs`);
  }
  return errors;
}

async function normalisePixels(page) {
  await page.addStyleTag({ content:`
    *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
    #map{visibility:hidden!important}
  `});
  await page.evaluate(() => {
    document.querySelectorAll('input[type="checkbox"]').forEach(el=>el.checked=false);
    document.querySelectorAll('input[type="radio"][value="dark"]').forEach(el=>el.checked=true);
    const input=document.getElementById('search-input'); if(input){input.value='';input.blur();}
    const results=document.getElementById('search-results'); if(results){results.innerHTML='';results.style.display='none';}
    document.querySelectorAll('.map-ctrl-btn').forEach(el=>el.classList.remove('active'));
    for(const id of ['radius-popup','radius-area-popup','zonedraw-display','measure-display','polyzone-display']){
      const el=document.getElementById(id); if(el)el.style.display='none';
    }
  });
  await page.waitForTimeout(80);
}

async function shot(page, region) {
  return page.locator(region.selector).screenshot({
    animations:'disabled', mask:region.masks.map(s=>page.locator(s)), maskColor:'#000000'
  });
}
async function pixelProof(aPage,bPage,viewport) {
  await Promise.all([normalisePixels(aPage),normalisePixels(bPage)]);
  const regions={};
  for(const region of pixelRegions){
    const [a,b]=await Promise.all([shot(aPage,region),shot(bPage,region)]);
    const ah=crypto.createHash('sha256').update(a).digest('hex'), bh=crypto.createHash('sha256').update(b).digest('hex');
    requireCondition(a.equals(b),`${viewport}: stable UI pixels differ for ${region.selector}`);
    regions[region.selector]={identical:true,sha256:ah,mirror_sha256:bh,bytes:a.length,masks:region.masks};
  }
  return { identical:true, method:'EXACT_STABLE_COMPONENT_PNG_BYTES', volatile_map_pixels_excluded:true,
    live_clock_text_masked:true, async_scada_grid_excluded_from_bitmap_but_exact_dom_gated:true, regions };
}

async function controlState(page,id){
  return page.evaluate(controlId=>{
    const display=s=>{const el=document.querySelector(s);return el?getComputedStyle(el).display:null;};
    return {active:document.getElementById(controlId)?.classList.contains('active')||false,
      radius:display('#radius-popup'),radius_area:display('#radius-area-popup'),zone:display('#zonedraw-display'),measure:display('#measure-display'),
      map_container_class:document.getElementById('map-container')?.className||'',body_class:document.body.className};
  },id);
}
async function interactionProof(a,b){
  const states={};
  for(const id of ['btn-radius','btn-radius-area','btn-zonedraw','btn-status','btn-measure']){
    await Promise.all([a.click(`#${id}`),b.click(`#${id}`)]);
    const [x,y]=await Promise.all([controlState(a,id),controlState(b,id)]);
    requireCondition(JSON.stringify(x)===JSON.stringify(y),`interaction differs after ${id}`); states[id]=y;
    await Promise.all([a.click(`#${id}`),b.click(`#${id}`)]);
  }
  return states;
}
async function bridgeProof(page){
  for(const id of ['400','dc','solar']){
    await page.locator(`#scada-ui-container input[data-layer-id="${id}"]`).check();
    await page.waitForFunction(layerId=>{const t=document.querySelector(`#lbl-${layerId}`)?.textContent||'';return /\[(?:OK|\d+)/.test(t)&&!t.includes('[FAIL]');},id,{timeout:90000});
  }
  const b=await page.evaluate(()=>window.__GRIDATLAS_V9_BRIDGE__);
  requireCondition(b?.intercepted>=3,'V9 bridge did not intercept sentinel loads');
  requireCondition(Object.keys(b?.loaded||{}).length>=3,'V9 bridge did not hydrate sentinel sources');
  requireCondition((b?.failures||[]).length===0,`V9 bridge failures: ${JSON.stringify(b?.failures||[])}`);
  return b;
}

const proof={schema:'gridatlas.v8-public-product-mirror-proof.v6',classification:'REJECTED',oracle:oracleUrl,mirror:mirrorUrl,bytes:null,viewports:{},interactions:null,bridge:null,errors:[]};
const browser=await chromium.launch({headless:true});
try{
  proof.bytes=await byteProof();
  for(const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]){
    const a=await browser.newPage({viewport}),b=await browser.newPage({viewport});
    try{
      await Promise.all([a.goto(oracleUrl,{waitUntil:'domcontentloaded',timeout:60000}),b.goto(mirrorUrl,{waitUntil:'domcontentloaded',timeout:60000})]);
      await Promise.all([ready(a),ready(b)]);
      const [as,bs]=await Promise.all([snapshot(a),snapshot(b)]),errors=compare(as,bs,viewport.name);
      requireCondition(errors.length===0,errors.join('\n'));
      proof.viewports[viewport.name]={structure_identical:true,pixels:await pixelProof(a,b,viewport.name)};
      if(viewport.name==='desktop'){proof.interactions=await interactionProof(a,b);proof.bridge=await bridgeProof(b);}
    }finally{await a.close();await b.close();}
  }
  proof.classification='VERIFIED_PUBLIC_V8_PRODUCT_MIRROR';
}catch(error){proof.errors.push(String(error?.stack||error));throw error;}
finally{
  await browser.close(); const parent=output.includes('/')?output.slice(0,output.lastIndexOf('/')):'.';
  await fs.mkdir(parent,{recursive:true}); await fs.writeFile(output,JSON.stringify(proof,null,2)+'\n');
}
console.log(JSON.stringify({classification:proof.classification,bridge_sources:Object.keys(proof.bridge?.loaded||{}).length}));
