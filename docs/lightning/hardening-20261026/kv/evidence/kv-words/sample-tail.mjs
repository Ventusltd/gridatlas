// kv-words sample renderer: real index + day shards + feed from Ventusltd/lightning 2a49652 (1,480 flashes, 29 searched days)
const KW = new URL('.', import.meta.url).pathname;
const IX = JSON.parse(readFileSync(KW + 'index-2a49652.json', 'utf8'));
const FEED = JSON.parse(readFileSync(KW + 'feed-2a49652.geojson', 'utf8'));
const files = {}; for (const d of IX.days) if (d.path) files[d.path] = readFileSync(KW + 'days2a/' + d.path);
const at = s => Date.parse('2026-10-27T' + s + ':00Z');
const show = (tag, x) => { const L = x.main.caps; console.log(`\n## ${tag}\nLABEL  ${x.label()}\nSTATUS ${x.status()}\nCAP1   ${(L.notice && L.notice.textContent) ? L.notice.textContent + '\nCAP1b  ' : ''}${L.window.textContent}\nCAP2   ${(L.days || L.actual).textContent}`); };
const run = async (tag, o, steps) => { const x = boot({ files, feedFn: () => FEED, ...o }); x.toggle(true); await drain();
  for (const s of steps) { if (s.chip) x.click(x.chip(s.chip)); if (s.nav) x.click(x.nav(s.nav)); if (s.from) { x.main.from.value = s.from; x.main.to.value = s.to; x.click(x.nav('apply')); } await drain(); }
  show(tag, x); };
for (const now of [at('13:45'), at('15:00')]) {
  console.log(`\n# now ${new Date(now).toISOString()} (index generated ${IX.generated_utc})`);
  for (const p of ['12h', '48h', '7d', '30d', '3m', '12m']) await run('archive ' + p, { index: IX, now }, [{ chip: p }]);
  await run('archive 30d PREV', { index: IX, now }, [{ chip: '30d' }, { nav: 'prev' }]);
  await run('archive 3m PREV', { index: IX, now }, [{ chip: '3m' }, { nav: 'prev' }]);
  await run('custom 2026-10-01..04 (all full)', { index: IX, now }, [{ chip: 'custom' }, { from: '2026-10-01', to: '2026-10-04' }]);
  await run('custom 2026-10-10..20', { index: IX, now }, [{ chip: 'custom' }, { from: '2026-10-10', to: '2026-10-20' }]);
  await run('custom 2026-10-27 (today)', { index: IX, now }, [{ chip: 'custom' }, { from: '2026-10-27', to: '2026-10-27' }]);
  await run('custom 2025-01-01..31 (before retention)', { index: IX, now }, [{ chip: 'custom' }, { from: '2025-01-01', to: '2025-01-31' }]);
  for (const p of ['24h', '7d', '12m']) await run('feed only (404) ' + p, { index: null, now }, [{ chip: p }]);
  await run('index unavailable (v1 schema) 7d', { index: { schema: 'uk-lightning-history-index.v1', days: [] }, now }, [{ chip: '7d' }]);
}
process.exit(0);
