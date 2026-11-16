/** Full local-only release and route-C rollback; never push or read acceptance. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const G='202611161720', BEFORE='202611161645', PARENT='202611132345';
function run(cwd,command,args,{allowFailure=false}={}) {
  const r=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:128*1024*1024});
  const output=(r.stdout||'')+(r.stderr||'');
  if(!allowFailure)assert.equal(r.status,0,`${command} ${args.join(' ')}\n${output}`);
  return {status:r.status,output};
}
const git=(cwd,...args)=>run(cwd,'git',args).output.trim();
assert.equal(git(ROOT,'status','--porcelain'),'','rehearsal requires a clean committed candidate');
const originalHead=git(ROOT,'rev-parse','HEAD');
assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT,'atlas/current.json'))).generation,PARENT);
fs.mkdirSync(path.join(ROOT,'work'),{recursive:true});
const checkout=fs.mkdtempSync(path.join(ROOT,'work','map-release-rehearsal-'));
assert.ok(path.resolve(checkout).startsWith(path.join(ROOT,'work')+path.sep));
run(ROOT,'git',['worktree','add','--detach',checkout,originalHead]);
fs.mkdirSync(path.join(checkout,'work'),{recursive:true});
const suffix=path.basename(checkout), branch=name=>`rehearsal/${suffix}/${name}`;
const json=name=>JSON.parse(fs.readFileSync(path.join(checkout,'work',name)));
const invoke=(script,args)=>run(checkout,'node',[script,...args],{allowFailure:true});
const summary={candidate_commit:originalHead,generation:G,parent:PARENT};
try {
  // Exercise the exact rejected release, not a synthetic validator fixture.
  const before=invoke('tools/release/release-generation.mjs',[
    '--generation',BEFORE,'--base',originalHead,'--expect-live',PARENT,
    '--branch',branch('before'),'--authorised-by','Local regression rehearsal only; never publish',
    '--report','work/before.json','--log','work/before.log']);
  assert.equal(before.status,1,'old preview must fail real promotion');
  const failed=json('before.json');
  assert.deepEqual(failed.gates.filter(g=>!g.ok).map(g=>g.gate).sort(),[
    'verify-compose',`rollback.mjs --to ${PARENT} --dry-run`].sort());
  const beforeLog=fs.readFileSync(path.join(checkout,'work/before.log'),'utf8');
  assert.match(beforeLog,/composition copied full application/);
  assert.match(beforeLog,/not an ancestor/);
  assert.equal(git(checkout,'status','--porcelain'),'');
  assert.equal(git(checkout,'rev-parse','HEAD'),originalHead);
  summary.before={expected_failure:true,gates:failed.gates};
  console.log('BEFORE PASS: real release rejects missing copy attestation and parent lineage, restoring pointer/STATE.');

  const after=invoke('tools/release/release-generation.mjs',[
    '--generation',G,'--base',originalHead,'--expect-live',PARENT,
    '--branch',branch('release'),'--authorised-by','Local regression rehearsal only; never publish',
    '--report','work/after.json','--log','work/after.log']);
  assert.equal(after.status,0,after.output);
  const released=json('after.json');
  assert.ok(released.gates.length>=7 && released.gates.every(g=>g.ok));
  assert.equal(JSON.parse(fs.readFileSync(path.join(checkout,'atlas/current.json'))).generation,G);
  assert.deepEqual(git(checkout,'diff','--name-only',`${released.release_commit}^`,released.release_commit).split('\n').sort(),['STATE.md','atlas/current.json']);
  summary.after={gates:released.gates,release_commit:released.release_commit,before:released.before,after:released.after};
  console.log('AFTER PASS: actual release committed only pointer/STATE; every promotion gate passed.');

  // The preview gate sees the predecessor; exercise the full PR gate with the actual promoted composition.
  const promotedGate=invoke('tools/ci/pr-gate.mjs',['--base',originalHead]);
  fs.writeFileSync(path.join(checkout,'work/promoted-pr-gate.log'),promotedGate.output);
  assert.equal(promotedGate.status,0,promotedGate.output);
  summary.promoted_pr_gate={passed:true,summary:promotedGate.output.match(/\d+\/\d+ checks passed/)?.[0]};
  console.log('PROMOTED PR GATE PASS: '+summary.promoted_pr_gate.summary);

  const reverted=invoke('tools/release/rollback-generation.mjs',[
    '--release-commit',released.release_commit,'--base',released.release_commit,
    '--branch',branch('rollback'),'--reason','Local route-C regression rehearsal only; never publish',
    '--report','work/rollback.json','--log','work/rollback.log']);
  assert.equal(reverted.status,0,reverted.output);
  const rollback=json('rollback.json');
  assert.ok(rollback.gates.every(g=>g.ok));
  assert.deepEqual(rollback.byte_exact,{'atlas/current.json':true,'STATE.md':true});
  assert.equal(JSON.parse(fs.readFileSync(path.join(checkout,'atlas/current.json'))).generation,PARENT);
  assert.equal(git(checkout,'diff',originalHead,'HEAD','--','atlas/current.json','STATE.md'),'');
  assert.equal(git(checkout,'status','--porcelain'),'');
  summary.rollback={gates:rollback.gates,byte_exact:rollback.byte_exact,from:rollback.from,to:rollback.to};
  console.log('ROLLBACK PASS: route C restored predecessor pointer and STATE byte-for-byte; every rollback gate passed.');
  summary.result='PASS';
} finally {
  assert.equal(git(ROOT,'rev-parse','HEAD'),originalHead);
  assert.equal(git(ROOT,'status','--porcelain'),'');
  // Only this path-free summary is uploaded. Full local reports remain in the isolated checkout.
  fs.writeFileSync(path.join(ROOT,'work','map-promotion-rehearsal.json'),JSON.stringify(summary,null,2)+'\n');
}
