// usage: node summarise.mjs <node dir>  -> SUMMARY.txt on stdout
import { readFileSync, readdirSync } from 'node:fs';
const D = process.argv[2];
for (const f of readdirSync(D).filter(f => f.endsWith('.json')).sort()) {
  const o = JSON.parse(readFileSync(D + '/' + f, 'utf8')); const u = o.unit;
  console.log(`===== ${f.replace('.json', '')}  now=${o.now}  gen=${o.generation}`);
  console.log(' index:', JSON.stringify(u.index), u.index_schema ? JSON.stringify(u.index_schema) : '');
  if (u.rows_rejected_by_vk) console.log(' vk rejects:', u.rows_rejected_by_vk.length, JSON.stringify(u.rows_rejected_by_vk.slice(0, 5)), 'row kinds', JSON.stringify(u.row_kinds));
  if (u.shards) console.log(' shards:', JSON.stringify(u.shards.map(s => `${s.path}:${s.ok ? s.features + '/' + s.okFeatures : 'ERR ' + s.error}`)));
  if (u.cv_since_20oct) console.log(' cv since 20 Oct:', JSON.stringify(u.cv_since_20oct));
  console.log(' feed:', JSON.stringify(u.feed), 'status.json present', u.status_json_present, 'requested', o.requests.status_json_requested);
  for (const p of o.panel) { if (p.skipped) { console.log(`  [${p.tag}] ${p.skipped}`); continue; }
    console.log(`  [${p.tag}] ${p.status} | ${p.label} | drawn=${p.drawn} layer=${p.layer} dot=${p.dot}`);
    for (const k of ['window', 'actual', 'flashes', 'refresh', 'searched', 'warning']) if (p.caps[k]) console.log(`       ${p.caps[k]}`); }
  console.log(' fetch:', JSON.stringify(o.requests.fetch.map(r => r[0] + ' ' + r[1])), 'xhr', JSON.stringify(o.requests.xhr), 'errors', JSON.stringify(o.handler_errors), JSON.stringify(o.module_errors));
}
