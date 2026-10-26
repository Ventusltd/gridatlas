// compare.mjs <a.json> <b.json> [prefix]: field-level differences between two probe result files
import { readFileSync } from 'node:fs';
const [a, b, prefix = 'R_'] = process.argv.slice(2);
const A = JSON.parse(readFileSync(a)).scenarios, B = JSON.parse(readFileSync(b)).scenarios;
const flat = (o, p = '', out = {}) => { for (const [k, v] of Object.entries(o || {})) { if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, p + k + '.', out); else out[p + k] = JSON.stringify(v); } return out; };
for (const name of Object.keys(A).filter(n => n.startsWith(prefix))) {
  const fa = flat(A[name].obs), fb = flat(B[name] && B[name].obs);
  const keys = [...new Set([...Object.keys(fa), ...Object.keys(fb)])].filter(k => fa[k] !== fb[k]);
  console.log(`${name}: ${keys.length ? keys.length + ' field(s) differ' : 'IDENTICAL'}`);
  for (const k of keys) console.log(`   ${k}\n     - ${fa[k]}\n     + ${fb[k]}`);
}
