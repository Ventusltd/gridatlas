#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const CAMPAIGN = '202608310050-gridatlas-next-version-builders';
const OUTPUT_ROOT = path.join(ROOT, CAMPAIGN, 'outputs');
const MATERIALISED = path.join(ROOT, 'work', '202608310050-build-plan');
const REQUIRED_WORDS = 43_000;
const NOT_BEFORE = Date.parse('2026-08-31T00:15:00Z');
const CAMPAIGN_END = Date.parse('2026-08-31T09:00:00Z');
const REQUIRED = [
  'NEXT-VERSION.md',
  'summary.md',
  'window-intelligence.md',
  'questions.md',
  'DRAFT-CARTRIDGES/exact-ref-index.spec.md',
  'DRAFT-CARTRIDGES/exact-ref-index.js.txt',
  'DRAFT-CARTRIDGES/window-intelligence.spec.md',
  'DRAFT-CARTRIDGES/window-intelligence.js.txt'
];
const STAGES = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n11', 'handover'];
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.js', '.mjs', '.cjs', '.py', '.yml', '.yaml', '.csv', '.html', '.css']);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function londonGeneration(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const pick = type => parts.find(part => part.type === type)?.value;
  return `${pick('year')}${pick('month')}${pick('day')}${pick('hour')}${pick('minute')}`;
}

function output(values) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  fs.appendFileSync(file, `${Object.entries(values).map(([key, value]) => `${key}=${String(value).replaceAll('\n', '%0A')}`).join('\n')}\n`);
}

function listFiles(directory) {
  const result = [];
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(target));
    else if (entry.isFile()) result.push(target);
  }
  return result.sort();
}

function wordCount(text) {
  return (String(text).match(/[A-Za-z0-9][A-Za-z0-9_’'\-]*/g) || []).length;
}

function inspectBuildPlan(directory) {
  const plan = path.join(directory, '_build-plan');
  const files = listFiles(plan).filter(file => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()));
  let words = 0;
  let bytes = 0;
  const digest = crypto.createHash('sha256');
  for (const file of files) {
    const relative = path.relative(plan, file).split(path.sep).join('/');
    const content = fs.readFileSync(file);
    digest.update(relative);
    digest.update('\0');
    digest.update(crypto.createHash('sha256').update(content).digest());
    bytes += content.length;
    words += wordCount(content.toString('utf8'));
  }
  const missing = REQUIRED.filter(relative => !fs.existsSync(path.join(plan, relative)));
  return { plan, files: files.length, words, bytes, missing, fingerprint: digest.digest('hex') };
}

function refs() {
  const raw = execFileSync('git', ['for-each-ref', '--format=%(refname:short)|%(objectname)|%(committerdate:unix)', 'refs/remotes/origin'], { encoding: 'utf8' });
  const seen = new Set();
  const rows = [];
  for (const line of raw.trim().split(/\r?\n/).filter(Boolean)) {
    const [ref, sha, unix] = line.split('|');
    if (!ref || ref.endsWith('/HEAD') || seen.has(sha)) continue;
    seen.add(sha);
    rows.push({ ref, sha, unix: Number(unix || 0) });
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!seen.has(head)) rows.push({ ref: 'HEAD', sha: head, unix: Math.floor(Date.now() / 1000) });
  return rows;
}

function materialise(ref, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  const archive = spawnSync('git', ['archive', '--format=tar', ref, '_build-plan'], { encoding: null, maxBuffer: 128 * 1024 * 1024 });
  if (archive.status !== 0) return false;
  const untar = spawnSync('tar', ['-xf', '-', '-C', destination], { input: archive.stdout, encoding: null, maxBuffer: 128 * 1024 * 1024 });
  return untar.status === 0;
}

function completedStages() {
  const complete = new Set();
  if (!fs.existsSync(OUTPUT_ROOT)) return complete;
  for (const directory of fs.readdirSync(OUTPUT_ROOT, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const statusPath = path.join(OUTPUT_ROOT, directory.name, 'status.json');
    if (!fs.existsSync(statusPath)) continue;
    try {
      const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      if (status.completed === true && STAGES.includes(status.stage)) complete.add(status.stage);
    } catch {}
  }
  return complete;
}

function main() {
  const now = Date.now();
  const active = now < CAMPAIGN_END;
  const mature = now >= NOT_BEFORE;
  execFileSync('git', ['fetch', '--all', '--prune', '--tags', '--force'], { stdio: 'inherit' });
  const candidates = [];
  for (const row of refs()) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gridatlas-plan-'));
    try {
      if (!materialise(row.ref, temporary)) continue;
      const inspected = inspectBuildPlan(temporary);
      candidates.push({ ...row, ...inspected, temporary });
    } catch {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
  candidates.sort((a, b) => {
    const aComplete = a.missing.length === 0 ? 1 : 0;
    const bComplete = b.missing.length === 0 ? 1 : 0;
    return bComplete - aComplete || b.words - a.words || b.unix - a.unix;
  });
  const selected = candidates[0] || null;
  const ready = Boolean(selected && selected.words >= REQUIRED_WORDS && selected.missing.length === 0);
  let stage = '';
  let generation = '';
  let outputDir = '';
  if (active && mature && ready) {
    materialise(selected.ref, MATERIALISED);
    invariant(fs.existsSync(path.join(MATERIALISED, '_build-plan', 'NEXT-VERSION.md')), 'materialised build plan is incomplete');
    const complete = completedStages();
    stage = STAGES.find(item => !complete.has(item)) || '';
    if (stage) {
      generation = londonGeneration();
      const runId = process.env.GITHUB_RUN_ID || `manual-${process.pid}`;
      outputDir = path.join(CAMPAIGN, 'outputs', `${generation}-${stage}-gridatlas-run-${runId}`).split(path.sep).join('/');
      fs.mkdirSync(path.join(ROOT, outputDir), { recursive: true });
      fs.writeFileSync(path.join(ROOT, outputDir, 'source-lock.json'), `${JSON.stringify({
        schema: 'gridatlas.next-version-build-plan-lock.v1', generation, stage,
        selected_ref: selected.ref, selected_sha: selected.sha,
        files: selected.files, words: selected.words, bytes: selected.bytes,
        fingerprint: selected.fingerprint, required_words: REQUIRED_WORDS,
        required_files: REQUIRED, missing: selected.missing,
        materialised_path: 'work/202608310050-build-plan/_build-plan',
        live_pointer_mutation: false, immutable_shell_mutation: false
      }, null, 2)}\n`);
    }
  }
  for (const candidate of candidates) {
    if (candidate.temporary) fs.rmSync(candidate.temporary, { recursive: true, force: true });
  }
  const result = {
    active, mature, ready, stage, generation, output_dir: outputDir,
    source_ref: selected?.ref || '', source_sha: selected?.sha || '',
    source_words: selected?.words || 0, source_files: selected?.files || 0,
    missing: selected?.missing.join(',') || '', campaign_complete: ready && !stage
  };
  output(result);
  console.log(JSON.stringify(result, null, 2));
}

main();
