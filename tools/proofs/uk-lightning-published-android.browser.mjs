/** Run a real Android-Chrome-emulated browser against the *published*
 * GitHub Pages URL.  Nothing intercepted, mocked, or served from checkout.
 * This is NOT a physical Android handset and does not test iPhone Safari. */
import {chromium, devices} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const URL='https://ventusltd.github.io/gridatlas/atlas/preview/lightning/';
const out=path.resolve('work/published-android-lightning');
mkdirSync(out,{recursive:true});
const report={url:URL,at:new Date().toISOString(),profiles:[]};
const browser=await chromium.launch({headless:true});
let failed=false;
for(const [name,device] of [
 ['Pixel_7',devices['Pixel 7']],
 ['Galaxy_S9',{viewport:{width:360,height:740},deviceScaleFactor:3,isMobile:true,hasTouch:true,
   userAgent:'Mozilla/5.0 (Linux; Android 13; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'}]
]){
 const r={name,errors:[],consoleErrors:[],networkFailures:[],http:[],final:null};
 report.profiles.push(r);
 const context=await browser.newContext({...device,ignoreHTTPSErrors:false});
 const page=await context.newPage();
 page.setDefaultTimeout(20000);
 page.on('pageerror',e=>r.errors.push(String(e)));
 page.on('console',msg=>{if(msg.type()==='error')r.consoleErrors.push(msg.text().slice(0,500));});
 page.on('requestfailed',req=>r.networkFailures.push({url:req.url(),reason:req.failure()?.errorText}));
 page.on('response',res=>{
  const u=res.url();
  if(u.includes('preview/lightning/')||u.includes('raw.githubusercontent.com/Ventusltd/lightning')||u.includes('/gridatlas/atlas/cartridges/'))
   r.http.push({status:res.status(),url:u.slice(0,220),contentType:res.headers()['content-type']});
 });
 try{
  const first=await page.goto(URL,{waitUntil:'domcontentloaded',timeout:55000});
  r.entryHttp=first?.status();
  await page.waitForTimeout(8000);
  r.initial=await page.evaluate(()=>({
   href:location.href,base:document.baseURI,bodyRouter:document.body?.dataset.gridatlasRouter,
   generation:window.__GRIDATLAS_ATLAS__?.generation,
   weather:window.__GRIDATLAS_WEATHER_LIGHTNING__||null,
   menu:window.__GRIDATLAS_MODULES__?.menuBar?{
    installed:window.__GRIDATLAS_MODULES__.menuBar.installed,
    waiting_for:window.__GRIDATLAS_MODULES__.menuBar.waiting_for,
    failure:window.__GRIDATLAS_MODULES__.menuBar.failure,
    inspect:window.__GRIDATLAS_MODULES__.menuBar.inspect?.()
   }:null,
   hasMap:!!window.__GRIDATLAS_V9_MAP__,
   hasWeatherToggle:!!document.querySelector('[data-weather-layer="uk_lightning"]'),
   weatherGroups:document.querySelectorAll('[data-weather-group="uk_lightning"]').length,
   menuBar:!!document.querySelector('#gridatlas-menu-bar'),
   content:document.body?.innerText?.slice(0,700)
  }));
  const grid=page.getByRole('button',{name:'Grid',exact:true});
  r.gridMenuButton=await grid.count();
  if(r.gridMenuButton){
   await grid.click({timeout:14000});
   await page.waitForTimeout(400);
   r.menu=await page.evaluate(()=>{
    const body=document.querySelector('#gridatlas-menu-bar-panel-4 .gm-panel-body');
    const inp=document.querySelector('[data-weather-layer="uk_lightning"]');
    const group=document.querySelector('[data-weather-group="uk_lightning"]');
    const gRect=body?.getBoundingClientRect(),r=inp?.getBoundingClientRect();
    return {expanded:document.querySelector('#gridatlas-menu-bar-title-4')?.getAttribute('aria-expanded'),
      panelVisible:!!document.querySelector('.gm-open .gm-panel'),
      groupText:group?.textContent,firstGroup:body?.firstElementChild?.getAttribute('data-weather-group'),
      togglePresent:!!inp,toggleChecked:inp?.checked,groupVisible:!!(group?.getClientRects().length),
      toggleBox:r?{x:r.x,y:r.y,w:r.width,h:r.height}:null,
      panelBox:gRect?{x:gRect.x,y:gRect.y,w:gRect.width,h:gRect.height}:null,
      firstViewportVisible:!!(r&&gRect&&r.top>=gRect.top-1&&r.bottom<=gRect.bottom+1),
      menuText:document.querySelector('#gridatlas-menu-bar-panel-4')?.innerText?.slice(0,700)};
   });
   await page.screenshot({path:path.join(out,name+'-grid-open.png'),fullPage:false,timeout:12000});
   if(r.menu?.togglePresent){
    const checkbox=page.locator('[data-weather-layer="uk_lightning"]');
    await checkbox.click({timeout:14000});
    await page.waitForTimeout(10000);
    r.afterToggle=await page.evaluate(()=>{
     const m=window.__GRIDATLAS_V9_MAP__;
     const w=window.__GRIDATLAS_WEATHER_LIGHTNING__;
     const s=m?.getSource('src-uk_lightning');
     return {weather:w,checked:document.querySelector('[data-weather-layer="uk_lightning"]')?.checked,
       label:document.querySelector('#lbl-uk_lightning')?.textContent,
       layerVisibility:m?.getLayer('l-uk_lightning')?m.getLayoutProperty('l-uk_lightning','visibility'):null,
       sourceFeatures:s?._data?.features?.length??null};
    });
    await page.screenshot({path:path.join(out,name+'-lightning-toggled.png'),fullPage:false,timeout:12000});
   }
  }
  if(r.initial?.generation!=='202610231505'||!r.menu?.togglePresent||!r.menu?.firstViewportVisible)failed=true;
 }catch(e){r.exception=String(e);failed=true;await page.screenshot({path:path.join(out,name+'-failure.png'),timeout:12000}).catch(()=>{});}
 r.final={errors:r.errors.slice(-12),consoleErrors:r.consoleErrors.slice(-12),networkFailures:r.networkFailures.slice(-12),http:r.http.slice(-30)};
 console.log('PUBLISHED_ANDROID_RESULT '+JSON.stringify(r));
 await context.close();
}
await browser.close();
writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
if(failed){console.error('PUBLISHED_ANDROID_CHECK_FAILED');process.exitCode=1;}else console.log('PUBLISHED_ANDROID_CHECK_PASSED');
