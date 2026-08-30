#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const buildPlan = path.resolve(process.argv[2] || '');
const outputDir = path.resolve(process.argv[3] || '');
const stage = process.argv[4] || '';
const campaignOutputRoot = path.resolve(process.argv[5] || path.dirname(outputDir));
if (!fs.existsSync(buildPlan)) throw new Error(`build plan missing: ${buildPlan}`);
fs.mkdirSync(outputDir, { recursive: true });

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function writeJson(name, value) {
  fs.writeFileSync(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function copy(relative, targetDirectory = 'source') {
  const source = path.join(buildPlan, relative);
  if (!fs.existsSync(source)) throw new Error(`required build-plan file missing: ${relative}`);
  const target = path.join(outputDir, targetDirectory, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return { path: relative, bytes: fs.statSync(target).size, sha256: sha256(target) };
}

if (stage === 'n5') {
  const sources = [
    ['postcodes_io', 'postcodes.io', 'live geocoder; rate, attribution and browser-use constraints must be verified'],
    ['nominatim', 'Nominatim / OpenStreetMap', 'live explicit geocoder; rate and attribution policy must be verified'],
    ['repd', 'DESNZ REPD', 'frozen project spine; licence and attribution must be completed'],
    ['planit', 'PlanIt', 'planning register adapter source'],
    ['planning_data_gov_uk', 'planning.data.gov.uk', 'official planning data source'],
    ['thegazette', 'The Gazette', 'distress evidence source'],
    ['lowcarboncontracts', 'Low Carbon Contracts Company', 'CfD evidence source'],
    ['companies_house_bulk', 'Companies House bulk', 'Route A funding/distress source'],
    ['companies_house_rest', 'Companies House REST', 'Route B charges/PSC/officer-count source']
  ];
  const cards = [];
  for (const [slug, publisher, purpose] of sources) {
    const file = path.join(outputDir, 'source-cards', `${slug}.md`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `# ${publisher}\n\n- Source-card status: draft\n- Last checked: unknown\n- Publisher: ${publisher}\n- Purpose in federation: ${purpose}\n- Licence: study required\n- Attribution requirement: study required\n- Access method: study required\n- API key requirement: study required\n- Rate limit: study required\n- Update frequency: study required\n- Declared fields: not approved\n- Derived-only fields: not approved\n- Known gaps: not yet studied\n- Known failure modes: not yet studied\n- Allowed use: none until reviewed\n- Not-allowed use: declared truth before approval\n- Screening boundary: candidate research only\n\nThis timestamped card is a review skeleton generated from the complete build plan. It is not an approval and must not be promoted as source truth.\n`, 'utf8');
    cards.push({ path: `source-cards/${slug}.md`, sha256: sha256(file) });
  }
  const sourceDocs = [copy('spiders-feeds.md'), copy('NEXT-VERSION.md')];
  writeJson('readiness.json', {
    schema: 'gridatlas.n5-source-card-candidate-pack.v1',
    stage, classification: 'DRAFT_UNVERIFIED_NOT_APPROVED',
    cards, source_docs: sourceDocs,
    promotion_eligible: false,
    rule: 'No card may leave draft until licence, attribution, access, rate and last-checked fields are externally verified.'
  });
} else if (stage === 'n6') {
  const required = [
    'window-intelligence.md', 'questions.md',
    'DRAFT-CARTRIDGES/exact-ref-index.spec.md',
    'DRAFT-CARTRIDGES/exact-ref-index.js.txt',
    'DRAFT-CARTRIDGES/window-intelligence.spec.md',
    'DRAFT-CARTRIDGES/window-intelligence.js.txt',
    'NEXT-VERSION.md', 'CARTRIDGE-CATALOG.md'
  ];
  const files = required.map(relative => copy(relative, 'frozen-inputs'));
  writeJson('readiness.json', {
    schema: 'gridatlas.n6-window-intelligence-input-lock.v1',
    stage, classification: 'FROZEN_INPUT_BUNDLE_NOT_INSTALLED', files,
    required_build_order: ['register-adapter', 'project-vehicle-projection', 'state-machine-ranker', 'two-silent-generations', 'window-intelligence-cartridge'],
    hard_constraints: ['preserve-pre-snap-rewrite', 'funding-window-group-first', 'fail-closed-core-unchanged', 'no-person-keys', 'no-ownership-claim'],
    promotion_eligible: false
  });
} else if (stage === 'n11') {
  const docs = [copy('DATA-DELIVERY-PLAN.md'), copy('CARTRIDGE-CATALOG.md'), copy('NEXT-VERSION.md')];
  writeJson('readiness.json', {
    schema: 'gridatlas.n11-pmtiles-readiness.v1',
    stage, classification: 'DELIVERY_PLAN_LOCKED_BUILD_NOT_EXECUTED', source_docs: docs,
    layers: [
      { id: 'uk_motorways', minzoom: 5 },
      { id: 'uk_mainline_railways', minzoom: 6 },
      { id: 'uk_trunk_roads', minzoom: 7 },
      { id: 'uk_primary_roads', minzoom: 9 }
    ],
    viewport_transfer_budget_bytes: 500000,
    blockers: ['select and pin an exact PMTiles library version', 'build archives in data-gridatlas', 'declare geometry simplification tolerance', 'extend fidelity comparator to decoded tile union'],
    duckdb_drawing_plane_forbidden: true,
    promotion_eligible: false
  });
} else if (stage === 'handover') {
  const runs = [];
  if (fs.existsSync(campaignOutputRoot)) {
    for (const entry of fs.readdirSync(campaignOutputRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const statusPath = path.join(campaignOutputRoot, entry.name, 'status.json');
      if (!fs.existsSync(statusPath)) continue;
      try { runs.push({ folder: entry.name, ...JSON.parse(fs.readFileSync(statusPath, 'utf8')) }); } catch {}
    }
  }
  runs.sort((a, b) => String(a.generation).localeCompare(String(b.generation)));
  writeJson('handover.json', {
    schema: 'gridatlas.next-version-overnight-handover.v1',
    generated_at: new Date().toISOString(), runs,
    completed_stages: runs.filter(run => run.completed).map(run => run.stage),
    failed_stages: runs.filter(run => !run.completed).map(run => run.stage),
    live_pointer_modified: false,
    immutable_shell_modified: false,
    automatic_promotion: false
  });
  const rows = runs.map(run => `<tr><td>${run.generation || ''}</td><td>${run.stage || ''}</td><td>${run.status || ''}</td><td><a href="../${run.folder}/">${run.folder}</a></td></tr>`).join('');
  fs.writeFileSync(path.join(outputDir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>GridAtlas overnight next versions</title><style>body{font:14px monospace;background:#050505;color:#ddd;padding:24px}a{color:#0ff}table{border-collapse:collapse}td,th{border:1px solid #555;padding:8px;text-align:left}</style><h1>GridAtlas overnight next versions</h1><p>Candidate evidence only. No live pointer or immutable shell was changed.</p><table><thead><tr><th>Generation</th><th>Stage</th><th>Status</th><th>Folder</th></tr></thead><tbody>${rows}</tbody></table>`, 'utf8');
} else {
  throw new Error(`unsupported readiness stage: ${stage}`);
}
