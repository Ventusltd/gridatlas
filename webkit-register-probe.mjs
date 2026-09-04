import { webkit } from 'playwright';
const B='https://ventusltd.github.io/gridatlas/atlas/?';
const CASES=[
 ['12588','Botley West','solar','51.8132088','-1.3489728','WORKS on his phone'],
 ['14293','Houston Solar','solar','55.8676363','-4.5501937','FAILED on his phone'],
 ['20388','Berden Hall Solar Farm','solar','51.9369457','0.1309736','FAILED'],
 ['15530','Braston New Energy','bess','55.4430887','-4.5945148','FAILED'],
 ['6564','Birkhall Estate','hydro','57.00447','-3.08141','FAILED'],
 ['15543','Cruachan Upgrade Project','hydro','56.3959','-5.11752','FAILED'],
];
const br=await webkit.launch();
for(const [ref,name,tech,lat,lon,label] of CASES){
  const ctx=await br.newContext({viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const p=await ctx.newPage();
  const errs=[],deep=[];
  p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  p.on('console',m=>{const t=m.text(); if(/DEEP LINK|register|absent|retry|identity/i.test(t)) deep.push(t.slice(0,160));});
  const u=`${B}repd_ref=${ref}&project=${encodeURIComponent(name)}&technology=${tech}&capacity_mw=1&latitude=${lat}&longitude=${lon}&zoom=12`;
  await p.goto(u,{waitUntil:'load',timeout:60000}).catch(e=>errs.push('goto '+e.message));
  await p.waitForTimeout(14000);
  const s=await p.evaluate(()=>{
    const L=window.__GRIDATLAS_NEON_LINKS__, P=window.__GRIDATLAS_PLACE_SEARCH__||window.placeSearch;
    const m=window.__GRIDATLAS_V9_MAP__;
    const ans=[...document.querySelectorAll('body *')].find(e=>e.children.length<6&&/Nearest .* substation/.test(e.innerText||''));
    const dl=(P&&P.deep_link)||null;
    return {card:!!ans,drawn:L?L.links_drawn:null,fail:L?L.failures:null,
      centre:m?[+m.getCenter().lng.toFixed(3),+m.getCenter().lat.toFixed(3)]:null,zoom:m?+m.getZoom().toFixed(1):null,
      dlStatus:dl?dl.status:null,identity:dl?dl.identity_source:null,
      notInRegister:/not in the active-register snapshot/i.test(document.body.innerText)};
  }).catch(e=>({evalError:e.message}));
  console.log(`${ref.padEnd(6)} ${label.padEnd(20)} card=${s.card} drawn=${s.drawn} zoom=${s.zoom} centre=${JSON.stringify(s.centre)} dl=${s.dlStatus} identity=${s.identity} notInRegister=${s.notInRegister} errs=${errs.length}`);
  if(errs.length) console.log('        ERR:',errs[0]);
  await ctx.close();
}
await br.close();
