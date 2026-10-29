/**
 * Offline tests of the delivery-flow rules in flow-lib.mjs (run by
 * tools/ci/pr-gate.mjs, check release-tools). No network, no gh.
 *
 *   node --test tools/release/flow.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseVerdict, trustedActor, decideAcceptance, classifyPr, generationFiles, PROGRESS_DOC_RE, acceptLabel, OWNER_LOGINS
} from './flow-lib.mjs';
import { deriveCurrent, rerootForPreview } from './lib.mjs';

const G = '202610290045';
const owner = { login: OWNER_LOGINS[0] };
const comment = (body, at, extra = {}) => ({ body, created_at: at, user: owner, performed_via_github_app: null, html_url: `https://x/c/${at}`, ...extra });

test('parseVerdict reads only the first non-blank line, for exactly this generation', () => {
  assert.equal(parseVerdict(`ACCEPT ${G}`, G), 'accept');
  assert.equal(parseVerdict(`\n  /accept ${G}\nlooks good on the phone`, G), 'accept');
  assert.equal(parseVerdict(`accepted ${G}.`, G), 'accept');
  assert.equal(parseVerdict(`REJECT ${G}: the card overlaps`, G), 'reject');
  assert.equal(parseVerdict(`ACCEPT 202610290050`, G), null);
  assert.equal(parseVerdict(`ACCEPT ${G}0`, G), null);
  assert.equal(parseVerdict(`I would ACCEPT ${G}`, G), null);
  assert.equal(parseVerdict(`Looks fine\nACCEPT ${G}`, G), null);
  assert.equal(parseVerdict('', G), null);
});

test('trustedActor: owner login, no GitHub App, no agent signature', () => {
  assert.equal(trustedActor(owner, null, `ACCEPT ${G}`).ok, true);
  assert.equal(trustedActor({ login: 'someone-else' }, null).ok, false);
  assert.equal(trustedActor(owner, { slug: 'chatgpt-codex-connector' }).ok, false);
  assert.equal(trustedActor(owner, null, `ACCEPT ${G}\n\nClaude-Session: https://claude.ai/code/x`).ok, false);
  assert.equal(trustedActor(owner, null, `ACCEPT ${G}\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`).ok, false);
  assert.equal(trustedActor(null, null).ok, false);
});

test('decideAcceptance: latest trusted verdict wins; untrusted ones are reported, not counted', () => {
  assert.equal(decideAcceptance(G, {}).state, 'none');
  const a = decideAcceptance(G, { comments: [comment(`ACCEPT ${G}`, '2026-10-29T03:00:00Z')] });
  assert.equal(a.state, 'accepted');
  assert.equal(a.by, owner.login);
  assert.equal(a.via, 'comment');
  const r = decideAcceptance(G, { comments: [comment(`ACCEPT ${G}`, '2026-10-29T03:00:00Z'), comment(`REJECT ${G}`, '2026-10-29T04:00:00Z')] });
  assert.equal(r.state, 'rejected');
  const back = decideAcceptance(G, { comments: [comment(`REJECT ${G}`, '2026-10-29T03:00:00Z'), comment(`ACCEPT ${G}`, '2026-10-29T04:00:00Z')] });
  assert.equal(back.state, 'accepted');
  const codex = decideAcceptance(G, { comments: [comment(`ACCEPT ${G}`, '2026-10-29T03:00:00Z', { performed_via_github_app: { slug: 'chatgpt-codex-connector' } })] });
  assert.equal(codex.state, 'none');
  assert.equal(codex.ignored.length, 1);
  const other = decideAcceptance(G, { comments: [comment(`ACCEPT ${G}`, '2026-10-29T03:00:00Z', { user: { login: 'mallory' } })] });
  assert.equal(other.state, 'none');
});

test('decideAcceptance: the accepted:<G> label, and its removal', () => {
  const ev = (event, at, actor = owner, app = null) => ({ event, created_at: at, actor, performed_via_github_app: app, label: { name: acceptLabel(G) }, issue: { html_url: 'https://x/pull/59' } });
  assert.equal(decideAcceptance(G, { events: [ev('labeled', '2026-10-29T03:00:00Z')] }).state, 'accepted');
  assert.equal(decideAcceptance(G, { events: [ev('labeled', '2026-10-29T03:00:00Z'), ev('unlabeled', '2026-10-29T03:05:00Z')] }).state, 'none');
  assert.equal(decideAcceptance(G, { events: [ev('labeled', '2026-10-29T03:00:00Z', owner, { slug: 'bot' })] }).state, 'none');
  assert.equal(decideAcceptance(G, { events: [{ ...ev('labeled', '2026-10-29T03:00:00Z'), label: { name: 'accepted:202610290050' } }] }).state, 'none');
});

test('classifyPr: preview, release (with prep commits), rollback, other', () => {
  const pr = (ref) => ({ head: { ref } });
  const f = (...names) => names.map(n => ({ filename: n, status: n.startsWith('atlas/v/') ? 'added' : 'modified' }));
  assert.equal(classifyPr(pr('claude/x'), f(`atlas/v/${G}/current.json`, `atlas/v/${G}/index.html`), G), 'preview');
  assert.equal(classifyPr(pr(`release/${G}-gridatlas-v9.176`), f('atlas/current.json', 'STATE.md'), G), 'release');
  assert.equal(classifyPr(pr(`release/${G}-gridatlas-v9.176`), f('.github/workflows/x.yml', 'tools/scope/lib.mjs', 'atlas/current.json', 'STATE.md'), G), 'release');
  assert.equal(classifyPr(pr(`rollback/${G}-to-202610281340`), f('atlas/current.json', 'STATE.md'), G), 'rollback');
  assert.equal(classifyPr(pr('docs/x'), f('docs/RELEASE.md'), G), 'other');
  assert.equal(classifyPr(pr(`release/${G}-x`), f('docs/RELEASE.md'), G), 'other');
});

test('the seven preview files', () => {
  assert.deepEqual(Object.values(generationFiles(G)).sort(), [
    `atlas/cartridges/${G}-sld-sandbox-v9-8.js`, `atlas/manifests/${G}-composition.json`, `atlas/modules/${G}-uk-lightning-overlay.js`,
    `atlas/v/${G}/current.json`, `atlas/v/${G}/index.html`, `tools/proofs/${G}-sld-sandbox.proof.mjs`]);
  assert.ok(PROGRESS_DOC_RE.test(`docs/lightning/CANDIDATE-${G}-M4-progress.md`));
  assert.ok(!PROGRESS_DOC_RE.test(`docs/lightning/CANDIDATE-${G}.md`));
});

test('the preview route is the release pointer re-rooted (the cut post-condition)', () => {
  const manifest = JSON.stringify({ generation: G, composition_manifest: `./manifests/${G}-composition.json`, version: 'v9.176', cut_at_utc: 'x',
    cartridges: [{ id: 'a', path: './cartridges/a.js', contract: '../ui/a.mjs' }] }, null, 1) + '\n';
  const route = rerootForPreview(deriveCurrent(manifest));
  assert.match(route, /"path": "\.\.\/\.\.\/cartridges\/a\.js"/);
  assert.match(route, /"contract": "\.\.\/\.\.\/ui\/a\.mjs"/);
  assert.doesNotMatch(route, /cut_at_utc|"version"/);
});

test('cut-generation refuses bad input before writing anything', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cut = (...a) => spawnSync('node', [path.join(here, 'cut-generation.mjs'), ...a], { encoding: 'utf8' });
  assert.match(cut('--gen', '202610291260', '--version', 'v9.999', '--module', 'x').stderr, /not a real UTC minute/);
  assert.match(cut('--gen', '20261029', '--version', 'v9.999', '--module', 'x').stderr, /YYYYMMDDHHMM/);
  assert.match(cut('--gen', '202612312359', '--version', '9.999', '--module', 'x').stderr, /v9\.N/);
  assert.match(cut('--gen', '202612312359', '--version', 'v9.999').stderr, /--module is required/);
});
