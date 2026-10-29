/**
 * Shared helpers for the delivery-flow scripts in tools/release/ (cut,
 * preview, acceptance, release, live bytes, homepage label, served check,
 * status). See docs/RELEASE.md, "The delivery flow".
 *
 * GitHub is read and written only through `gh api` on repository-scoped REST
 * endpoints. GraphQL (and so `gh pr create`, `gh pr list`) and the search API
 * are not available from every environment the flow runs in, so nothing here
 * depends on them.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, run } from './lib.mjs';

export const GRIDATLAS = process.env.GRIDATLAS_REPO || 'Ventusltd/gridatlas';
export const HOMEPAGE = process.env.GRIDATLAS_HOMEPAGE_REPO || 'Ventusltd/globalgrid2050-homepage';
export const DOMAIN = process.env.GRIDATLAS_DOMAIN_REPO || 'Ventusltd/globalgrid2050';
export const PAGES_BASE = 'https://ventusltd.github.io/gridatlas/';
export const DOMAIN_BASE = 'https://www.globalgrid2050.com/';
export const LIVE_BYTES_WORKFLOW = '202608301321-verify-live.yml';
export const PR_GATE_WORKFLOW = 'pr-file-size-guard.yml';
export const DOMAIN_DEPLOY_WORKFLOW = 'deploy-pages.yml';

/* Who may accept a generation. The owner's GitHub login; override with a
   comma-separated GRIDATLAS_OWNER_LOGINS. */
export const OWNER_LOGINS = (process.env.GRIDATLAS_OWNER_LOGINS || 'Ventusltd')
  .split(',').map(s => s.trim()).filter(Boolean);

export const STAMP = /^\d{12}$/;

/** The six files a cut writes for generation G (the lightning line). */
export function generationFiles(G) {
  return {
    module: `atlas/modules/${G}-uk-lightning-overlay.js`,
    cartridge: `atlas/cartridges/${G}-sld-sandbox-v9-8.js`,
    proof: `tools/proofs/${G}-sld-sandbox.proof.mjs`,
    manifest: `atlas/manifests/${G}-composition.json`,
    routeIndex: `atlas/v/${G}/index.html`,
    routeCurrent: `atlas/v/${G}/current.json`
  };
}
/** The optional seventh: the candidate's progress note. */
export const PROGRESS_DOC = (G, name) => `docs/lightning/CANDIDATE-${G}-${name}-progress.md`;
export const PROGRESS_DOC_RE = /^docs\/lightning\/CANDIDATE-(\d{12})-[A-Za-z0-9._-]+-progress\.md$/;

/** True when an agent (Claude Code, CI) is running this process. */
export function runningAsAgent() {
  return Boolean(process.env.CLAUDECODE || process.env.CLAUDE_CODE_SESSION_ID || process.env.CODEX_SANDBOX
    || process.env.GITHUB_ACTIONS || process.env.CI);
}

/* ------------------------------------------------------------------ gh api */

export class GhError extends Error {}

/** `gh api` returning parsed JSON (or text with raw: true). */
export function gh(endpoint, { method = 'GET', fields = {}, raw = false, input } = {}) {
  const argv = ['api', '-X', method, endpoint];
  if (raw) argv.push('-H', 'Accept: application/vnd.github.raw');
  for (const [k, v] of Object.entries(fields)) argv.push(typeof v === 'string' ? '-f' : '-F', `${k}=${v}`);
  if (input !== undefined) argv.push('--input', '-');
  const r = spawnSync('gh', argv, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, input });
  if (r.error) throw new GhError(`gh not runnable: ${r.error.message}`);
  if (r.status !== 0) throw new GhError(`gh api ${method} ${endpoint}: ${(r.stderr || r.stdout).trim().split('\n').pop()}`);
  if (raw) return r.stdout;
  const text = r.stdout.trim();
  if (!text) return null;
  return JSON.parse(text);
}

/** Every page of a list endpoint. `gh --paginate` follows Link headers that
    use numeric repositories/{id} paths, which some proxies refuse, so pages
    are requested explicitly. */
export function ghAll(endpoint, { perPage = 100, maxPages = 30 } = {}) {
  const out = [];
  const sep = endpoint.includes('?') ? (endpoint.endsWith('?') ? '' : '&') : '?';
  for (let page = 1; page <= maxPages; page += 1) {
    const rows = gh(`${endpoint}${sep}per_page=${perPage}&page=${page}`);
    const list = Array.isArray(rows) ? rows : [];
    out.push(...list);
    if (list.length < perPage) break;
  }
  return out;
}

/** A file at a ref of a repository, or null when it does not exist. */
export function ghFile(repo, ref, relative) {
  try { return gh(`repos/${repo}/contents/${relative}?ref=${encodeURIComponent(ref)}`, { raw: true }); }
  catch (error) { if (/Not Found|404/.test(error.message)) return null; throw error; }
}

export function ghHeadSha(repo, branch = 'main') {
  return gh(`repos/${repo}/commits/${branch}`).sha;
}

/* --------------------------------------------------------- PRs and comments */

/** Pull requests whose title, body or head branch names G (newest first). */
export function prsNaming(G, { pulls } = {}) {
  const all = pulls || gh(`repos/${GRIDATLAS}/pulls?state=all&per_page=100&sort=created&direction=desc`);
  return all.filter(p => [p.title, p.body || '', p.head?.ref || ''].some(t => t.includes(G)));
}

export function prFiles(number) {
  return ghAll(`repos/${GRIDATLAS}/pulls/${number}/files`);
}

/** Classify a PR for G: a preview adds atlas/v/G/current.json; a release is
    a release/G-* branch that changes atlas/current.json; a rollback likewise
    on rollback/G-*. */
export function classifyPr(pr, files, G) {
  const names = files.map(f => f.filename);
  if (files.some(f => f.filename === `atlas/v/${G}/current.json` && f.status === 'added')) return 'preview';
  const ref = pr.head?.ref || '';
  /* A release PR may carry preparatory commits (L3's retired a workflow) before the pointer commit. */
  if (ref.startsWith(`release/${G}`) && names.includes('atlas/current.json')) return 'release';
  if (ref.startsWith('rollback/') && ref.includes(G) && names.includes('atlas/current.json')) return 'rollback';
  return 'other';
}

/* ------------------------------------------------------------- acceptance */

/*
 * An acceptance is ONE of:
 *   - a comment, anywhere in the gridatlas repository (issue or PR), whose
 *     first non-blank line is `ACCEPT <G>` (or `/accept <G>`), optionally
 *     followed by free text on later lines;
 *   - the label `accepted:<G>` on the preview PR.
 * It counts only when it was made by an OWNER_LOGINS account, not through a
 * GitHub App (Codex and other connectors post as the owner with an app
 * marker), and carries no agent signature. A later `REJECT <G>` comment, or
 * the removal of the label, withdraws it.
 *
 * No script in tools/release/ writes either form. Agents running with the
 * owner's token must not post them; acceptance.mjs --record refuses to run
 * under an agent and only prints the owner's command.
 */
export const AGENT_SIGNATURES = [/Claude-Session:/i, /Generated (?:with|by) \[Claude Code\]/i, /noreply@anthropic\.com/i, /chatgpt-codex/i];
export const acceptLabel = (G) => `accepted:${G}`;

export function parseVerdict(body, G) {
  const first = String(body || '').split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
  const m = first.match(/^\/?(ACCEPT|ACCEPTED|REJECT|REJECTED)\s+(\d{12})\b/i);
  if (!m || m[2] !== G) return null;
  return /^REJECT/i.test(m[1]) ? 'reject' : 'accept';
}

export function trustedActor(user, app, body = '') {
  if (!user || !OWNER_LOGINS.includes(user.login)) return { ok: false, why: `by ${user?.login ?? 'unknown'}, not an owner login (${OWNER_LOGINS.join(', ')})` };
  if (app) return { ok: false, why: `posted through the GitHub App ${app.slug || app.name}` };
  const sig = AGENT_SIGNATURES.find(re => re.test(body));
  if (sig) return { ok: false, why: `carries an agent signature (${sig})` };
  return { ok: true };
}

/**
 * Decide acceptance of G from repository comments and label events.
 *   comments: GET repos/R/issues/comments (any order)
 *   events:   GET repos/R/issues/events  (labeled / unlabeled)
 * Returns { state: 'accepted'|'rejected'|'none', by, at, url, ignored: [...] }.
 */
export function decideAcceptance(G, { comments = [], events = [] }) {
  const verdicts = [];
  const ignored = [];
  for (const c of comments) {
    const v = parseVerdict(c.body, G);
    if (!v) continue;
    const t = trustedActor(c.user, c.performed_via_github_app, c.body);
    if (!t.ok) { ignored.push({ url: c.html_url, why: t.why }); continue; }
    verdicts.push({ verdict: v, by: c.user.login, at: c.created_at, url: c.html_url, via: 'comment' });
  }
  for (const e of events) {
    if (!['labeled', 'unlabeled'].includes(e.event) || e.label?.name !== acceptLabel(G)) continue;
    const t = trustedActor(e.actor, e.performed_via_github_app);
    if (!t.ok) { ignored.push({ url: e.issue?.html_url, why: `label ${e.event} ${t.why}` }); continue; }
    verdicts.push({ verdict: e.event === 'labeled' ? 'accept' : 'withdraw', by: e.actor.login, at: e.created_at,
      url: e.issue?.html_url, via: `label ${acceptLabel(G)}` });
  }
  verdicts.sort((a, b) => a.at.localeCompare(b.at));
  const last = verdicts[verdicts.length - 1];
  if (!last) return { state: 'none', ignored, history: verdicts };
  const state = last.verdict === 'accept' ? 'accepted' : last.verdict === 'reject' ? 'rejected' : 'none';
  return { state, ...last, ignored, history: verdicts };
}

/** Acceptance of G read from GitHub: every repository comment since `since`,
    and the label events of the PRs that name G. */
export function readAcceptance(G, { since, pulls } = {}) {
  const q = since ? `&since=${encodeURIComponent(since)}` : '';
  const comments = ghAll(`repos/${GRIDATLAS}/issues/comments?sort=created${q}`);
  const events = prsNaming(G, { pulls })
    .flatMap(p => ghAll(`repos/${GRIDATLAS}/issues/${p.number}/events?`).map(e => ({ ...e, issue: { html_url: p.html_url } })))
    .filter(e => !since || e.created_at >= since);
  return decideAcceptance(G, { comments, events });
}

/** G's cut_at_utc, from the local checkout or gridatlas main. */
export function cutAtUtc(G) {
  const rel = generationFiles(G).manifest;
  const local = path.join(ROOT, rel);
  const text = fs.existsSync(local) ? fs.readFileSync(local, 'utf8') : ghFile(GRIDATLAS, 'main', rel);
  return text ? (JSON.parse(text).cut_at_utc || null) : null;
}

/* --------------------------------------------------------------- workflows */

export function workflowRuns(repo, workflow, { branch, headSha, event, perPage = 20 } = {}) {
  const q = [`per_page=${perPage}`];
  if (branch) q.push(`branch=${branch}`);
  if (headSha) q.push(`head_sha=${headSha}`);
  if (event) q.push(`event=${event}`);
  return gh(`repos/${repo}/actions/workflows/${workflow}/runs?${q.join('&')}`).workflow_runs || [];
}

export function checkRunsFor(repo, sha) {
  return gh(`repos/${repo}/commits/${sha}/check-runs?per_page=100`).check_runs || [];
}

export function dispatchWorkflow(repo, workflow, ref, inputs = {}) {
  const body = JSON.stringify({ ref, inputs });
  gh(`repos/${repo}/actions/workflows/${workflow}/dispatches`, { method: 'POST', input: body });
}

/** Open a DRAFT pull request through REST (gh pr create needs GraphQL). */
export function openDraftPr({ repo = GRIDATLAS, head, base = 'main', title, body }) {
  return gh(`repos/${repo}/pulls`, { method: 'POST', input: JSON.stringify({ head, base, title, body, draft: true }) });
}

/* ------------------------------------------------------------------ misc */

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(path.resolve(file), `${JSON.stringify(data, null, 1)}\n`);
}

export function readCommittedJson(rev, relative, cwd = ROOT) {
  const r = run('git', ['show', `${rev}:${relative}`], { cwd, allowFail: true });
  return r.status === 0 ? JSON.parse(r.stdout) : null;
}

export function pad(rows) {
  const widths = rows[0].map((_, i) => Math.max(...rows.map(r => String(r[i]).length)));
  return rows.map(r => r.map((c, i) => String(c).padEnd(widths[i])).join('  ').trimEnd()).join('\n');
}
