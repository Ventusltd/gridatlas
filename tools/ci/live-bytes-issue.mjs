#!/usr/bin/env node
/* Open, refresh or close the one GitHub issue labelled "live-bytes" from the
   result of the live-bytes job (202608301321-verify-live.yml).

     failure     the public Pages site does not serve the committed bytes (or
                 the verifier failed): open the issue, or refresh the open one
                 (body replaced, no notification; one comment per new commit)
     success     every path matched: close any open issue with a comment
     superseded  main moved during verification (the newer run decides),
     skipped, cancelled: leave the issue as it is

   Node built-ins only (fetch). Token from GH_TOKEN or GITHUB_TOKEN.

     node tools/ci/live-bytes-issue.mjs --report work/live-bytes.json \
          --outcome failure|success|superseded|skipped|cancelled \
          [--repo owner/name] [--run-url URL]
     node tools/ci/live-bytes-issue.mjs --self-test   # no network: in-memory fake API
*/
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export const LABEL = 'live-bytes';
const LABEL_COLOR = 'b60205';
const LABEL_DESCRIPTION = 'The public Pages site is not serving the committed bytes (verify-live.yml live-bytes job)';
const MAX_LISTED = 30;

function argument(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

export function readReport(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

export function issueText(report, { runUrl = '', now = new Date() } = {}) {
  const r = report || {};
  const commit = r.commit || 'unknown';
  const short = String(commit).slice(0, 7);
  const title = `Live site does not serve the committed bytes (commit ${short}, generation ${r.generation || 'unknown'})`;
  const mismatches = Array.isArray(r.mismatches) ? r.mismatches : [];
  const problems = Array.isArray(r.problems) ? r.problems : [];
  const lines = mismatches.slice(0, MAX_LISTED).map(m =>
    `- \`${m.path}\` (${m.why}): HTTP ${m.http ?? 'none'}, committed ${m.expected?.bytes ?? '?'} B, live ${m.live?.bytes ?? 'none'} B`);
  if (mismatches.length > MAX_LISTED) lines.push(`- … and ${mismatches.length - MAX_LISTED} more (see the run's live-bytes artifact)`);
  const body = [
    report
      ? `**${r.paths_matched ?? '?'}/${r.paths_checked ?? '?'}** paths byte-identical at ${r.base_url || 'the public site'} for commit \`${commit}\` (generation ${r.generation || 'unknown'}) after ${r.attempts ?? '?'} attempt(s).`
      : '**The live-bytes verifier wrote no report** (it failed before comparing; see the run log).',
    '',
    ...(problems.length ? ['Problems:', ...problems.map(p => `- ${p}`), ''] : []),
    ...(lines.length ? ['Mismatches:', ...lines, ''] : []),
    `Run: ${runUrl || '(not given)'}`,
    '',
    'What to do: see `docs/OPERATIONS.md` ("live-bytes issue"). The next push to main whose live-bytes check passes closes this issue automatically.',
    '',
    `_Checked ${now.toISOString().replace(/\.\d+Z$/, 'Z')}._`
  ].join('\n');
  return { title, body, marker: `<!-- live-bytes:commit=${commit} -->` };
}

/* One open issue per label. Returns a one-line description of what was done. */
export async function syncIssue(api, { outcome, report, runUrl = '', now = new Date() }) {
  if (!['failure', 'success'].includes(outcome)) return `outcome ${outcome}: issue left as it is`;
  const open = await api.openIssues(LABEL);
  if (outcome === 'success') {
    for (const issue of open) {
      await api.comment(issue.number, `Recovered: the live site serves the committed bytes of \`${report?.commit || 'unknown'}\` (generation ${report?.generation || 'unknown'}, ${report?.paths_matched ?? '?'}/${report?.paths_checked ?? '?'} paths). ${runUrl}`.trim());
      await api.update(issue.number, { state: 'closed', state_reason: 'completed' });
    }
    return open.length ? `closed #${open.map(i => i.number).join(', #')}` : 'none open; nothing to do';
  }
  const { title, body, marker } = issueText(report, { runUrl, now });
  const full = `${marker}\n${body}`;
  if (!open.length) {
    await api.ensureLabel(LABEL, LABEL_COLOR, LABEL_DESCRIPTION);
    const created = await api.create(title, full, LABEL);
    return `opened #${created.number}`;
  }
  const [keep, ...extras] = open;
  const previous = keep.body || '';
  await api.update(keep.number, { title, body: full });
  let action = `updated #${keep.number}`;
  if (!previous.includes(marker)) {
    await api.comment(keep.number, `Still failing on a new commit.\n\n${body}`);
    action += ' (new commit; commented)';
  }
  for (const extra of extras) {
    await api.comment(extra.number, `Duplicate of #${keep.number} (two checks raced).`);
    await api.update(extra.number, { state: 'closed', state_reason: 'not_planned' });
  }
  return action;
}

export function githubApi(repo, token, base = 'https://api.github.com') {
  async function call(method, path, payload) {
    const response = await fetch(`${base.replace(/\/$/, '')}/repos/${repo}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`, accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28', 'user-agent': 'gridatlas-live-bytes-issue',
        ...(payload ? { 'content-type': 'application/json' } : {})
      },
      body: payload ? JSON.stringify(payload) : undefined
    });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`${method} ${path}: HTTP ${response.status} ${text.slice(0, 200)}`);
      error.status = response.status;
      throw error;
    }
    return text ? JSON.parse(text) : null;
  }
  return {
    async openIssues(label) {
      const rows = await call('GET', `/issues?state=open&labels=${encodeURIComponent(label)}&per_page=100&sort=created&direction=asc`);
      return (rows || []).filter(row => !row.pull_request);
    },
    async ensureLabel(name, color, description) {
      try { await call('POST', '/labels', { name, color, description }); } catch (error) { if (error.status !== 422) throw error; }
    },
    create: (title, body, label) => call('POST', '/issues', { title, body, labels: [label] }),
    update: (number, fields) => call('PATCH', `/issues/${number}`, fields),
    comment: (number, body) => call('POST', `/issues/${number}/comments`, { body })
  };
}

function fakeApi(seed = []) {
  const issues = new Map(seed.map(i => [i.number, { state: 'open', ...i }]));
  const log = { comments: [], labels: [] };
  let next = 100;
  return {
    issues, log,
    async openIssues(label) { return [...issues.values()].filter(i => i.state === 'open' && i.labels.includes(label)).sort((a, b) => a.number - b.number).map(i => ({ ...i })); },
    async ensureLabel(name) { log.labels.push(name); },
    async create(title, body, label) { next += 1; issues.set(next, { number: next, title, body, labels: [label], state: 'open' }); return issues.get(next); },
    async update(number, fields) { Object.assign(issues.get(number), fields); return issues.get(number); },
    async comment(number, body) { log.comments.push([number, body]); }
  };
}

async function selfTest() {
  const bad = { status: 'fail', commit: 'abc1234def', generation: '202610281340', base_url: 'https://x/', attempts: 60,
    paths_checked: 3, paths_matched: 2, problems: [], mismatches: [{ path: 'atlas/current.json', why: 'bytes differ', http: 200, expected: { bytes: 10 }, live: { bytes: 9 } }] };
  const good = { ...bad, status: 'pass', paths_matched: 3, mismatches: [] };
  const api = fakeApi([{ number: 5, labels: ['bug'] }]);
  assert.equal(await syncIssue(api, { outcome: 'success', report: good }), 'none open; nothing to do');
  assert.equal(await syncIssue(api, { outcome: 'failure', report: bad }), 'opened #101');
  assert.deepEqual(api.log.labels, [LABEL]);
  assert.match(api.issues.get(101).body, /2\/3\*\* paths/);
  assert.match(api.issues.get(101).body, /`atlas\/current.json` \(bytes differ\)/);
  assert.equal(await syncIssue(api, { outcome: 'failure', report: bad }), 'updated #101');
  assert.equal(api.log.comments.length, 0, 'same commit: refresh without a comment');
  assert.equal(await syncIssue(api, { outcome: 'failure', report: { ...bad, commit: 'fff0000' } }), 'updated #101 (new commit; commented)');
  assert.equal(await syncIssue(api, { outcome: 'superseded', report: good }), 'outcome superseded: issue left as it is');
  assert.equal(await syncIssue(api, { outcome: 'skipped', report: null }), 'outcome skipped: issue left as it is');
  assert.equal(api.issues.get(101).state, 'open');
  assert.equal(await syncIssue(api, { outcome: 'success', report: good }), 'closed #101');
  assert.equal(api.issues.get(101).state, 'closed');
  assert.equal(api.issues.get(5).state, 'open', 'other labels untouched');
  assert.match(issueText(null).body, /wrote no report/);
  const raced = fakeApi([{ number: 7, labels: [LABEL] }, { number: 9, labels: [LABEL] }]);
  await syncIssue(raced, { outcome: 'failure', report: bad });
  assert.equal(raced.issues.get(7).state, 'open');
  assert.equal(raced.issues.get(9).state, 'closed');
  const long = { ...bad, mismatches: Array.from({ length: 45 }, (_, i) => ({ path: `p${i}`, why: 'missing', http: 404, expected: { bytes: 1 } })) };
  assert.match(issueText(long).body, /and 15 more/);
  console.log('live-bytes-issue self-test: PASS');
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest();
  const outcome = argument(argv, 'outcome', '');
  const report = readReport(argument(argv, 'report', 'work/live-bytes.json'));
  const repo = argument(argv, 'repo', process.env.GITHUB_REPOSITORY || 'Ventusltd/gridatlas');
  const runUrl = argument(argv, 'run-url', '');
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!outcome) throw new Error('--outcome is required');
  if (!['failure', 'success'].includes(outcome)) { console.log(`live-bytes issue: outcome ${outcome}: left as it is`); return; }
  if (!token) throw new Error('GH_TOKEN or GITHUB_TOKEN is required');
  const action = await syncIssue(githubApi(repo, token, process.env.GITHUB_API_URL), { outcome, report, runUrl });
  console.log(`live-bytes issue: ${action}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n- live-bytes issue: ${action}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    console.log(`::error title=live-bytes issue::${String(error.message || error).replace(/\r?\n/g, ' ')}`);
    process.exit(1);
  });
}
