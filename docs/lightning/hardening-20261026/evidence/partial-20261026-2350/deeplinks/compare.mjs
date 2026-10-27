// compare.mjs <results.json> — diffs baseline vs candidate snapshots step by step.
// Fields compared for "identical original behaviour": path, search, hash, historyLength, historyState, localStorage,
// sessionStorage, cookie, windowName, map centre/zoom, engine/pipeline checked layers, deep-link state objects, and
// map sources/layers EXCLUDING the two lightning ids (gridatlas-lightning / l-gridatlas-lightning).
// Lightning checks (candidate): OFF at every load/reload/shared open; adds nothing to URL/storage when ON.
import { readFile } from 'node:fs/promises';
const R = JSON.parse(await readFile(process.argv[2], 'utf8'));
const LID = /gridatlas-lightning/;
const strip = s => s && ({
  path: s.path, search: s.search, hash: s.hash, historyLength: s.historyLength, historyState: s.historyState,
  localStorage: s.localStorage, sessionStorage: s.sessionStorage, cookie: s.cookie, windowName: s.windowName,
  map: s.map && (s.map.error ? s.map : { lng: s.map.lng, lat: s.map.lat, zoom: s.map.zoom, sources: s.map.sources.filter(x => !LID.test(x)), layers: s.map.layers.filter(x => !LID.test(x)), visible: s.map.visible.filter(x => !LID.test(x)) }),
  engineChecked: s.engineChecked, pnChecked: s.pnChecked, v8DeepLink: s.v8DeepLink, placeSearch: s.placeSearch,
  neon: s.neon, neonReconciliation: s.neonReconciliation, interconnectorArrival: s.interconnectorArrival,
});
const out = {}; let fails = 0;
for (const [name, byRoute] of Object.entries(R.cases)) {
  const b = byRoute.baseline, c = byRoute.candidate; const rec = { diffs: [], lightning: [], errors: [] };
  if (!b || !c) { rec.errors.push('missing route'); out[name] = rec; fails++; continue; }
  if (b.error) rec.errors.push('baseline: ' + b.error.split('\n')[0]);
  if (c.error) rec.errors.push('candidate: ' + c.error.split('\n')[0]);
  const n = Math.max(b.snaps.length, c.snaps.length);
  for (let i = 0; i < n; i++) {
    const sb = strip(b.snaps[i]), sc = strip(c.snaps[i]); const label = (c.snaps[i] || b.snaps[i]).label;
    if (!sb || !sc) { rec.diffs.push({ label, missing: !sb ? 'baseline' : 'candidate' }); continue; }
    for (const k of Object.keys(sb)) {
      const vb = JSON.stringify(sb[k]), vc = JSON.stringify(sc[k]);
      if (vb !== vc) rec.diffs.push({ label, field: k, baseline: sb[k], candidate: sc[k] });
    }
    const L = c.snaps[i].lightning;
    const expectOn = /^(lightning-on|lightning-on-before-reload|sharer|B-after-lightning-on|B#x1)$/.test(label) && L.present;
    rec.lightning.push({ label, present: L.present, checked: L.checked, source: L.sourcePresent, layer: L.layerPresent, moduleOn: L.moduleOn, receiverLightningRequests: c.snaps[i].receiverLightningRequests });
  }
  rec.candidateHarnessCrashesRetried = c.harnessCrashesRetried; rec.baselineHarnessCrashesRetried = b.harnessCrashesRetried;
  rec.pageErrors = { baseline: b.pageErrors, candidate: c.pageErrors };
  rec.sharedUrlWhileOn = c.sharedUrlWhileOn; rec.hrefOn = c.hrefOn; rec.hrefOff = c.hrefOff;
  rec.navs = { baseline: b.navs.map(u => u.replace(/^.*?\/atlas\/(v\/\d+\/)?/, '')), candidate: c.navs.map(u => u.replace(/^.*?\/atlas\/(v\/\d+\/)?/, '')) };
  rec.notes = { baseline: b.notes, candidate: c.notes };
  rec.verdict = rec.errors.length ? 'ERROR' : rec.diffs.length ? 'DIFF' : 'IDENTICAL';
  if (rec.verdict !== 'IDENTICAL') fails++;
  out[name] = rec;
  console.log(name.padEnd(30), rec.verdict, rec.diffs.length ? JSON.stringify(rec.diffs).slice(0, 600) : '', rec.errors.join(' | ').slice(0, 300));
  console.log('   lightning:', rec.lightning.map(x => `${x.label}=${x.checked ? 'ON' : 'OFF'}${x.source ? '+src' : ''}${x.layer ? '+lyr' : ''}${x.receiverLightningRequests !== undefined ? ' rq' + x.receiverLightningRequests : ''}`).join(', '));
}
console.log('NON-IDENTICAL CASES', fails);
process.stdout.write('');
await (await import('node:fs/promises')).writeFile(process.argv[2].replace(/results\.json$/, 'compare.json'), JSON.stringify(out, null, 2));
