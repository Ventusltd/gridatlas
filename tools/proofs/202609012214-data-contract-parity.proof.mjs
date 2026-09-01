/**
 * Data-contract parity: what a cartridge's bytes fetch is what its manifest
 * entry declares, product for product and schema for schema.
 *
 * Why this proof exists. From v9.63 to v9.69 the substation-intelligence
 * entry in atlas/current.json (and therefore every derived composition
 * manifest) declared derived/connection-points.v2.json with schema v2,
 * while the cartridge's own source required connection-points.v3 from
 * v9.65 onward, and the same entry listed both "v2-consumed" and
 * "v3-consumed" as capabilities. Codex held the release on it at
 * 202609011820 and again at 202609012205; the hold was right. A manifest
 * that names a superseded product is a provenance lie, and the immutable
 * manifests inherit it generation after generation until a gate stops it.
 *
 * What it checks, for every cartridge in current.json:
 *   - every Ventusltd product URL the cartridge's bytes name
 *     (https://raw.githubusercontent.com/Ventusltd/<repo>/main/<path>,
 *     string concatenations resolved) is declared on the entry, under
 *     data_source or data_sources, with the same repository and product;
 *   - the schema the bytes require for that product (the constant assigned
 *     next to the URL, or the module's ACCEPTS for the topology product)
 *     equals the entry's schema_required;
 *   - every declared source is actually named by the bytes (a declaration
 *     nothing fetches is as false as a fetch nothing declares);
 *   - no capability names a product version the entry does not declare;
 *   - the composition manifest of the current generation carries the same
 *     entries (it is derived, and this proves the derivation held).
 *
 * Fail closed: an entry with an undeclared fetch, or a declared source the
 * bytes do not name, is a FAIL, not a warning.
 *
 *   node tools/proofs/202609012214-data-contract-parity.proof.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ATLAS = path.join(ROOT, 'atlas');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

let passed = 0, failed = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; failures.push(name + (detail ? ` - ${detail}` : '')); console.log(`  FAIL ${name}${detail ? ' - ' + detail : ''}`); }
}

/* ── what the bytes name ──────────────────────────────────────────────
   String literals joined by + across line breaks are resolved first, so
   'https://raw.githubusercontent.com/Ventusltd/data-grid-gb/'
     + 'main/derived/connection-points.v3.json'
   reads as one URL. */
const joinLiterals = (source) => source.replace(/'\s*\n\s*\+\s*'/g, '').replace(/"\s*\n\s*\+\s*"/g, '');
const PRODUCT_URL = /https:\/\/raw\.githubusercontent\.com\/Ventusltd\/([A-Za-z0-9._-]+)\/main\/([A-Za-z0-9._/-]+)/g;

function productsNamedBy(source) {
  const joined = joinLiterals(source);
  const found = new Map();
  for (const m of joined.matchAll(PRODUCT_URL)) {
    const key = `${m[1]}:${m[2]}`;
    if (found.has(key)) continue;
    /* the schema constant is the nearest one AFTER the URL within 600
       characters, in one of the spellings the estate uses */
    const after = joined.slice(m.index, m.index + 600);
    const schema = after.match(/(?:REQUIRED_SCHEMA|GB_SCHEMA|ACCEPTS|SCHEMA)\s*=\s*'([^']+)'/);
    found.set(key, { repository: `Ventusltd/${m[1]}`, product: m[2], schema_in_bytes: schema ? schema[1] : null });
  }
  return found;
}

/* the topology product's schema lives in the network-topology module's
   ACCEPTS, not next to the URL in the body; resolve it from the bytes of
   the same cartridge (the module is composed into it) */
function schemaFromModule(source, product) {
  if (!/gb-transmission-network/.test(product)) return null;
  const m = source.match(/const ACCEPTS = '([^']+)'/);
  return m ? m[1] : null;
}

/* ── what the manifest declares ─────────────────────────────────────── */
function declaredBy(entry) {
  const list = [];
  if (entry.data_source) list.push(entry.data_source);
  for (const s of entry.data_sources || []) list.push(s);
  return list;
}

const current = readJson('atlas/current.json');
console.log(`\ndata-contract parity for ${current.composition_id} (${current.cartridges.length} cartridges)\n`);

for (const entry of current.cartridges) {
  const rel = path.join('atlas', entry.path.replace('./', ''));
  const source = read(rel);
  const named = productsNamedBy(source);
  const declared = declaredBy(entry);
  console.log(`${entry.id} ${entry.generation}: bytes name ${named.size} product(s), entry declares ${declared.length}`);

  for (const [, p] of named) {
    const d = declared.find(s => s.repository === p.repository && s.product === p.product);
    check(`${entry.id}: ${p.product} fetched by the bytes is declared on the entry`, !!d,
      d ? undefined : `declared: ${declared.map(s => s.product).join(', ') || 'nothing'}`);
    if (!d) continue;
    const schema = p.schema_in_bytes || schemaFromModule(source, p.product);
    check(`${entry.id}: ${p.product} schema in the bytes is the schema the entry requires`,
      !!schema && schema === d.schema_required, `bytes ${schema}, entry ${d.schema_required}`);
  }
  for (const d of declared) {
    const key = `${d.repository.replace('Ventusltd/', '')}:${d.product}`;
    check(`${entry.id}: declared source ${d.product} is named by the bytes`, named.has(key));
  }
  /* a capability that says "<product>-vN-consumed" must agree with a
     declared schema of that version */
  for (const cap of entry.capabilities || []) {
    const m = cap.match(/^(?:neso-etys-)?connection-points-v(\d+)-consumed$/);
    if (!m) continue;
    check(`${entry.id}: capability ${cap} agrees with a declared schema`,
      declared.some(s => s.schema_required && s.schema_required.endsWith(`.v${m[1]}`)));
  }
}

/* ── the derived manifest carries the same declarations ─────────────── */
const manifest = readJson(`atlas/manifests/${current.generation}-composition.json`);
check('the composition manifest is the current generation', manifest.generation === current.generation);
for (const entry of current.cartridges) {
  const twin = (manifest.cartridges || []).find(c => c.id === entry.id);
  check(`${entry.id}: the composition manifest declares the same sources as current.json`,
    !!twin && JSON.stringify(declaredBy(twin)) === JSON.stringify(declaredBy(entry)));
}

console.log(`\n${passed}/${passed + failed} checks passed`);
if (failed) { console.log('FAILURES'); for (const f of failures) console.log('  ' + f); process.exit(1); }
