#!/usr/bin/env node
/** Independent estate scanner: evidence first, screening claims labelled. */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GRID = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ESTATE = resolve(GRID, '..', '..');
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const OUT = resolve(arg('--out', join(GRID, 'governance')));
const TRACE = process.argv.includes('--trace');
const trace = text => { if (TRACE) console.log(`[scan] ${text}`); };
const repos = [
  ['gridatlas', GRID], ['pipelinenews', join(ESTATE, 'pipelinenews')],
  ['data-grid-gb', join(ESTATE, 'data-grid-gb')], ['cvaa', join(ESTATE, 'cvaa')],
  ['spiders', join(ESTATE, 'spiders')]
].filter(([, path]) => existsSync(join(path, '.git')))
  .map(([name, path]) => ({ name, path }));
const byName = new Map(repos.map(repo => [repo.name, repo]));
const git = (repo, args, max = 256) => execFileSync('git', ['-C', repo.path, ...args],
  { encoding: 'utf8', maxBuffer: max * 1024 * 1024 });
const codeExt = new Set(['.js', '.mjs', '.py', '.html', '.css', '.yml', '.yaml', '.md']);
const excluded = /(^|\/)(node_modules|vendor|archive|releases\/data|data\/projects)(\/|$)/;
const code = path => codeExt.has(extname(path).toLowerCase()) && !excluded.test(path);
const sha = text => createHash('sha256').update(text).digest('hex');
const lineOf = (text, offset) => text.slice(0, offset).split('\n').length;
const evidence = (repo, path, text, index, claim) => ({
  repo: repo.name, path, line: lineOf(text, index), claim
});

const report = {
  schema: 'gridatlas.estate-deep-scan.v1', generated_at: new Date().toISOString(),
  scope: repos.map(repo => repo.name), limitations: [
    'Static screening cannot prove runtime behaviour.',
    'Regex findings are candidates unless a named executable proof confirms them.',
    'Historical findings describe shipped history; only current-tree findings can fail this scan.'
  ], repos: {}, findings: [], deep_link: {}, composition: {}, modules: {}, debug: {}
};

function finding(severity, confidence, title, detail, items = []) {
  report.findings.push({ severity, confidence, title, detail, evidence: items });
}

// 1. Complete repository histories and current inventory.
for (const repo of repos) {
  trace(`${repo.name}: history`);
  const commits = git(repo, ['log', '--all', '--format=%H%x09%cI%x09%s']).trim()
    .split(/\r?\n/).filter(Boolean).map(line => {
      const [commit, timestamp, ...subject] = line.split('\t');
      return { commit, timestamp, subject: subject.join('\t') };
    });
  const files = git(repo, ['ls-files']).trim().split(/\r?\n/).filter(Boolean);
  const currentCode = [];
  for (const path of files.filter(code)) {
    const full = join(repo.path, path);
    if (!existsSync(full)) continue;
    const text = readFileSync(full, 'utf8');
    currentCode.push({ path, lines: text.split(/\r?\n/).length, bytes: Buffer.byteLength(text) });
  }
  report.repos[repo.name] = {
    commits: commits.length, first_commit: commits.at(-1) || null,
    latest_commit: commits[0] || null, tracked_files: files.length,
    code_files: currentCode.length,
    monoliths: currentCode.filter(file => file.lines >= 800).sort((a, b) => b.lines - a.lines),
    stamped_commits: commits.filter(item => /^\d{12}/.test(item.subject)).length
  };
}

// 2. Deep-link producer/consumer binding: discover variables, then their calls.
function queryContract(repo, mode, { gridAtlasOnly = false } = {}) {
  const result = new Map();
  let filesExamined = 0, boundVariables = 0;
  for (const path of git(repo, ['ls-files']).trim().split(/\r?\n/).filter(code)) {
    const full = join(repo.path, path);
    if (!existsSync(full)) continue;
    const text = readFileSync(full, 'utf8');
    if (!/URLSearchParams/.test(text)) continue;
    if (gridAtlasOnly && (!/(?:ventusltd\.github\.io\/gridatlas|\/gridatlas\/atlas\/|atlas[_-]?v\d)/i.test(text)
        || !/(?:atlas|projects)/i.test(path))) continue;
    filesExamined += 1;
    const variables = new Set();
    for (const match of text.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:new\s+)?URLSearchParams\b/g)) {
      variables.add(match[1]); boundVariables += 1;
    }
    // URL.searchParams is a typed platform property and is safe to recognise directly.
    variables.add('[A-Za-z_$][\\w$]*\\.searchParams');
    for (const variable of variables) {
      const receiver = variable.startsWith('[') ? variable : variable.replace(/[$]/g, '\\$&');
      const methods = mode === 'produce' ? '(?:set|append)' : 'get';
      const regex = new RegExp(`(?:${receiver})\\.${methods}\\(\\s*["'\\x60]([\\w-]+)["'\\x60]`, 'g');
      for (const match of text.matchAll(regex)) {
        const key = match[1];
        if (!result.has(key)) result.set(key, []);
        result.get(key).push(evidence(repo, path, text, match.index, `${mode}:${key}`));
      }
    }
  }
  return { keys: result, filesExamined, boundVariables };
}
const pipeline = byName.get('pipelinenews'), grid = byName.get('gridatlas');
const produced = queryContract(pipeline, 'produce', { gridAtlasOnly: true });
const consumed = queryContract(grid, 'consume');
const producedKeys = [...produced.keys.keys()].sort();
const consumedKeys = [...consumed.keys.keys()].sort();
report.deep_link = {
  produced: producedKeys, consumed: consumedKeys,
  produced_not_consumed: producedKeys.filter(key => !consumed.keys.has(key)),
  consumed_not_produced: consumedKeys.filter(key => !produced.keys.has(key)),
  producer_files_examined: produced.filesExamined,
  consumer_files_examined: consumed.filesExamined,
  producer_variables_bound: produced.boundVariables,
  consumer_variables_bound: consumed.boundVariables
};
if (!produced.filesExamined || !consumed.filesExamined || !produced.boundVariables || !consumed.boundVariables) {
  finding('P0', 'proved-by-zero-diagnostic', 'Deep-link scan examined no bound query surface',
    'A zero-match pass is a scanner failure, not evidence that no contract exists.');
}
/* Do not promote an unmatched static key to a product defect. A large release
   may contain both its own filter query and the outbound Atlas query, while
   the shell may consume navigation fields such as zoom outside a cartridge.
   The difference remains in the JSON as a review queue, not a finding. */

// 3. Current GridAtlas composition and generation-matched proof coverage.
const currentPath = join(grid.path, 'atlas/current.json');
if (existsSync(currentPath)) {
  const current = JSON.parse(readFileSync(currentPath, 'utf8'));
  const cartridges = current.cartridges || [];
  report.composition = { generation: current.generation, composition_id: current.composition_id,
    proof_resolution: 'tools/proofs/<cartridge.generation>-<cartridge.id>.proof.mjs',
    cartridges: cartridges.map(cartridge => {
      const proof = `tools/proofs/${cartridge.generation}-${cartridge.id}.proof.mjs`;
      return { id: cartridge.id, generation: cartridge.generation, path: cartridge.path,
        exists: existsSync(join(grid.path, 'atlas', cartridge.path.replace(/^\.\//, ''))),
        proof, proof_exists: existsSync(join(grid.path, proof)) };
    }) };
  for (const cartridge of report.composition.cartridges) {
    if (!cartridge.exists || !cartridge.proof_exists) finding('P0', 'proved-from-composition',
      `Current cartridge ${cartridge.id} lacks served bytes or its generation-matched proof`,
      JSON.stringify(cartridge));
  }
}

// 4. Proofs that silently skip authoritative inputs.
for (const path of git(grid, ['ls-files', 'tools/proofs']).trim().split(/\r?\n/).filter(Boolean)) {
  const full = join(grid.path, path);
  if (!existsSync(full)) continue;
  const text = readFileSync(full, 'utf8');
  for (const match of text.matchAll(/\bskip(?:ped)?\b|\[skip\]|continue-on-error/gi)) {
    finding('P1', 'screening', 'Proof or gate contains an optional/skip path',
      'Inspect whether the skipped input is authoritative for the claim being made.',
      [evidence(grid, path, text, match.index, match[0])]);
  }
}

// 5. Workflow hazards, interpreted through CVAA-like failure classes.
for (const repo of [pipeline, grid]) {
  const unpinned = [];
  const scheduledWrite = [];
  for (const path of git(repo, ['ls-files', '.github/workflows']).trim().split(/\r?\n/).filter(Boolean)) {
    const full = join(repo.path, path);
    if (!existsSync(full)) continue;
    const text = readFileSync(full, 'utf8');
    for (const match of text.matchAll(/uses:\s*[^\s@]+@(v\d+|main|master)\b/g))
      unpinned.push(evidence(repo, path, text, match.index, match[0]));
    if (/permissions:\s*[\s\S]{0,100}contents:\s*write/.test(text)
        && /schedule:/.test(text)) scheduledWrite.push(
      evidence(repo, path, text, text.indexOf('contents: write'), 'contents: write'));
  }
  if (unpinned.length) finding('P1', 'proved-static',
    `${repo.name} workflows use ${unpinned.length} mutable action reference(s)`,
    'Pin third-party actions to reviewed commit SHAs; the full evidence remains in JSON.', unpinned);
  if (scheduledWrite.length) finding('P1', 'proved-static',
    `${repo.name} has ${scheduledWrite.length} scheduled write workflow(s)`,
    'Review each mutation boundary for deterministic inputs, ceilings, proofs and owned rollback.', scheduledWrite);
}

// 6. Current monoliths and modular seams.
for (const [repoName, state] of Object.entries(report.repos)) for (const file of state.monoliths) {
  if (repoName === 'gridatlas' && file.lines >= 4000) finding('P1', 'proved-static',
    `GridAtlas current file is ${file.lines} lines`,
    'Do not edit the monolith directly for the next feature; extract a timestamped module with parity proof.',
    [{ repo: repoName, path: file.path, line: 1, claim: 'monolith' }]);
}

// 7. Duplicate named functions in current computing paths, with body hashes.
const duplicates = new Map();
for (const repo of [pipeline, grid, byName.get('data-grid-gb')].filter(Boolean)) {
  for (const path of git(repo, ['ls-files']).trim().split(/\r?\n/).filter(code)) {
    if (!/(atlas|grid|distance|cartridge|module|engine|compute|intelligence)/i.test(path)) continue;
    const full = join(repo.path, path);
    if (!existsSync(full)) continue;
    const text = readFileSync(full, 'utf8');
    for (const match of text.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([\w$]+)\s*\(([^)]*)\)\s*\{/g)) {
      const signature = `${match[1]}/${match[2].split(',').filter(Boolean).length}`;
      if (!duplicates.has(signature)) duplicates.set(signature, []);
      duplicates.get(signature).push({ ...evidence(repo, path, text, match.index, signature),
        nearby_sha256: sha(text.slice(match.index, match.index + 800).replace(/\s+/g, ' ')) });
    }
  }
}
report.modules.duplicate_function_signatures = [...duplicates.entries()]
  .filter(([, items]) => new Set(items.map(item => `${item.repo}:${item.path}`)).size > 1)
  .map(([signature, items]) => ({ signature, definitions: items }));

// 8. Map-click chain inventory.
const clickEvidence = [];
for (const path of git(grid, ['ls-files']).trim().split(/\r?\n/).filter(code)) {
  const full = join(grid.path, path);
  if (!existsSync(full)) continue;
  const text = readFileSync(full, 'utf8');
  for (const match of text.matchAll(/\.on\(\s*["']click["']|addEventListener\(\s*["']click["']/g)) {
    clickEvidence.push(evidence(grid, path, text, match.index, 'click-handler'));
  }
}
report.modules.map_click_handlers = clickEvidence;
report.debug = {
  deep_link_zero_is_failure: true,
  literal_backspace_bytes_in_claude_scanner: (() => {
    const path = join(grid.path, 'tools/ci/202609012230-deep-scan.mjs');
    return existsSync(path) && readFileSync(path).includes(String.fromCharCode(8));
  })()
};
if (report.debug.literal_backspace_bytes_in_claude_scanner) finding('P0', 'proved-by-byte-inspection',
  'The sibling deep scanner contains literal backspace bytes in its deep-link regexes',
  'Replace the corrupted regex literals and add a fixture proving non-zero known parameters.');

const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
report.findings.sort((a, b) => order[a.severity] - order[b.severity]
  || a.title.localeCompare(b.title));
mkdirSync(OUT, { recursive: true });
const jsonPath = join(OUT, '202609012240-estate-deep-scan.json');
const mdPath = join(OUT, '202609012240-estate-deep-scan.md');
writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
const md = ['# Estate deep scan: Pipeline News → GridAtlas map computation', '',
  `Generated: ${report.generated_at}`, '',
  'This is screening evidence. Only findings labelled `proved-*` are established defects.', '',
  '## Repository history', ''];
for (const [name, state] of Object.entries(report.repos)) md.push(
  `- **${name}:** ${state.commits} commits; ${state.stamped_commits} stamped; ${state.tracked_files} tracked files; ${state.monoliths.length} current files ≥800 lines.`);
md.push('', '## Deep-link contract', '',
  `- Produced: ${producedKeys.join(', ') || '(scanner failure: none)'}`,
  `- Consumed: ${consumedKeys.join(', ') || '(scanner failure: none)'}`,
  `- Produced but not consumed: ${report.deep_link.produced_not_consumed.join(', ') || 'none'}`,
  '', '## Findings', '');
for (const item of report.findings) md.push(`- **${item.severity} · ${item.confidence}: ${item.title}** — ${item.detail}`,
  ...item.evidence.slice(0, 3).map(e => `  - \`${e.repo}:${e.path}:${e.line}\` — ${e.claim}`));
md.push('', '## Map-click engineering order', '',
  '1. Keep immediate project identity and declared connection evidence independent of network fetch.',
  '2. Require a recognised, pinned data-grid-gb schema; missing authoritative bytes fail the proof.',
  '3. Select topology and fault current only by explicit declared connection voltage.',
  '4. Render existing circuits separately from planned changes; carry nulls and reconciliation gaps.',
  '5. Keep R/X/B as published parameters until a separately validated load-flow model exists.',
  '6. Extract the next feature as a timestamped module; never enlarge the 4,000-line sandbox.', '');
writeFileSync(mdPath, md.join('\n') + '\n', 'utf8');
console.log(JSON.stringify({ status: 'SCANNED', repos: repos.length,
  findings: report.findings.length, produced: producedKeys.length,
  consumed: consumedKeys.length, json: jsonPath, markdown: mdPath }, null, 2));
if (report.findings.some(item => item.severity === 'P0' && item.confidence.startsWith('proved'))) process.exitCode = 1;
