#!/usr/bin/env node
/**
 * Step 3 of the delivery flow: the owner's acceptance of a preview generation.
 *
 *   node tools/release/acceptance.mjs --generation G [--json]      read it (exit 0 accepted, 3 none, 4 rejected)
 *   node tools/release/acceptance.mjs --generation G --how --pr N  print the owner's one-line commands
 *   node tools/release/acceptance.mjs --generation G --record --pr N --i-am-the-owner [--note TEXT]
 *
 * HOW ACCEPTANCE IS RECORDED (by the owner, on GitHub, nowhere else)
 *   - a comment on the preview PR (or any gridatlas issue) whose FIRST line is
 *       ACCEPT <G>
 *     with anything the owner wants to add on later lines; or
 *   - the label  accepted:<G>  on the preview PR.
 *   `REJECT <G>` as a later comment, or removing the label, withdraws it.
 *
 * WHAT COUNTS (tools/release/flow-lib.mjs decideAcceptance)
 *   - the author is an owner login (GRIDATLAS_OWNER_LOGINS, default Ventusltd);
 *   - it was not posted through a GitHub App (Codex and other connectors post
 *     as the owner with an app marker) and carries no agent signature
 *     (Claude-Session:, "Generated with [Claude Code]", ...);
 *   - it was made after G was cut (the manifest's cut_at_utc);
 *   - the latest qualifying verdict wins.
 *
 * Agents work with the owner's token, so GitHub cannot tell an agent's comment
 * from the owner's by login alone. The rule is therefore procedural as well:
 * no agent and no script posts an ACCEPT line or the label. --record refuses
 * to run under Claude Code, Codex or CI, and needs --i-am-the-owner.
 */

import { parseArgs } from './lib.mjs';
import { GRIDATLAS, readAcceptance, acceptLabel, runningAsAgent, gh, cutAtUtc, OWNER_LOGINS } from './flow-lib.mjs';

const TOOL = 'acceptance';
const die = (m, code = 1) => { console.error(`${TOOL}: STOP: ${m}`); process.exit(code); };

let args;
try {
  args = parseArgs(process.argv.slice(2), {
    generation: {}, json: { bool: true }, how: { bool: true }, record: { bool: true }, pr: {},
    'i-am-the-owner': { bool: true }, note: {}, label: { bool: true }
  });
} catch (error) { die(error.message); }
const G = args.generation;
if (!G || !/^\d{12}$/.test(G)) die('--generation G (12 digits) is required');

const commentCmd = (pr) => `gh api -X POST repos/${GRIDATLAS}/issues/${pr}/comments -f body='ACCEPT ${G}'`;
const labelCmd = (pr) => `gh api -X POST repos/${GRIDATLAS}/issues/${pr}/labels -f 'labels[]=${acceptLabel(G)}'`;

if (args.how) {
  if (!args.pr) die('--how needs --pr N (the preview PR)');
  console.log(`Owner, to accept ${G} (either one; the first line of the comment must be exactly "ACCEPT ${G}"):\n` +
    `  on GitHub: comment "ACCEPT ${G}" on https://github.com/${GRIDATLAS}/pull/${args.pr}\n` +
    `  or:        ${commentCmd(args.pr)}\n  or:        ${labelCmd(args.pr)}\n` +
    `To withdraw: comment "REJECT ${G}" or remove the label.`);
  process.exit(0);
}

if (args.record) {
  if (runningAsAgent()) die('refused: an agent or CI is running this. Only the owner records acceptance; run with --how and pass the command to the owner.');
  if (!args['i-am-the-owner']) die('--record needs --i-am-the-owner');
  if (!args.pr) die('--record needs --pr N');
  if (args.label) {
    gh(`repos/${GRIDATLAS}/issues/${args.pr}/labels`, { method: 'POST', input: JSON.stringify({ labels: [acceptLabel(G)] }) });
    console.log(`label ${acceptLabel(G)} added to #${args.pr}`);
  } else {
    const c = gh(`repos/${GRIDATLAS}/issues/${args.pr}/comments`, { method: 'POST', input: JSON.stringify({ body: `ACCEPT ${G}${args.note ? `\n\n${args.note}` : ''}` }) });
    console.log(`acceptance recorded: ${c.html_url}`);
  }
  process.exit(0);
}

const since = cutAtUtc(G);
const a = readAcceptance(G, { since: since || undefined });
if (args.json) console.log(JSON.stringify({ generation: G, since, owner_logins: OWNER_LOGINS, ...a }, null, 1));
else {
  console.log(`${G}: ${a.state.toUpperCase()}${a.url ? `  ${a.via} by ${a.by} at ${a.at}  ${a.url}` : ''}`);
  for (const i of a.ignored) console.log(`  ignored: ${i.url}  ${i.why}`);
  if (a.state === 'none') console.log(`  (looked for "ACCEPT ${G}" comments and the ${acceptLabel(G)} label since ${since || 'the beginning'})`);
}
process.exit(a.state === 'accepted' ? 0 : a.state === 'rejected' ? 4 : 3);
