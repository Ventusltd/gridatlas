import { validateSelection } from './finding-loop.mjs';

let checks = 0;
function check(label, condition) {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${label}`);
}
function rejects(label, value) {
  let rejected = false;
  try { validateSelection(value); } catch { rejected = true; }
  check(label, rejected);
}

const digest = 'a'.repeat(64);
const accepted = validateSelection({
  kind: 'project',
  repd_ref: '13599',
  source_release: digest
});
check('exact project selection is accepted', accepted.repd_ref === '13599');
check('accepted selection is immutable', Object.isFrozen(accepted));
check('canonical output has exactly three fields', Object.keys(accepted).join(',') === 'kind,repd_ref,source_release');

rejects('missing repd_ref is rejected', { kind: 'project', source_release: digest });
rejects('empty repd_ref is rejected', { kind: 'project', repd_ref: '', source_release: digest });
rejects('whitespace-changing repd_ref is rejected', { kind: 'project', repd_ref: ' 13599 ', source_release: digest });
rejects('control characters are rejected', { kind: 'project', repd_ref: '13599\n', source_release: digest });
rejects('wrong kind is rejected', { kind: 'location', repd_ref: '13599', source_release: digest });
rejects('short source release is rejected', { kind: 'project', repd_ref: '13599', source_release: 'abc' });
rejects('uppercase source release is rejected', { kind: 'project', repd_ref: '13599', source_release: 'A'.repeat(64) });
rejects('extra coordinates are rejected', { kind: 'project', repd_ref: '13599', source_release: digest, latitude: 52 });
rejects('accessor fields are rejected', Object.defineProperties({}, {
  kind: { value: 'project', enumerable: true },
  repd_ref: { get() { return '13599'; }, enumerable: true },
  source_release: { value: digest, enumerable: true }
}));
rejects('arrays are rejected', ['project', '13599', digest]);

console.log(JSON.stringify({ status: 'PASS', iteration: 1, checks }));
