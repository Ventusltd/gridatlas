import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const source = await readFile(join(REPO, 'atlas/modules/202609012230-map-click-network.js'), 'utf8');
const box = { window: {}, console, Map, Object, Array, String, Number };
vm.createContext(box);
vm.runInContext(source, box);
const module = box.window.__GRIDATLAS_MODULES__.mapClickNetwork;
let passed = 0;
const failures = [];
function check(label, condition) {
  if (condition) { passed += 1; console.log(`  [PASS] ${label}`); }
  else { failures.push(label); console.log(`  [FAIL] ${label}`); }
}

check('the module loads frozen and names its exact owner schema', Object.isFrozen(module)
  && module.accepts === 'data-grid-gb.map-click-network.v1');
check('unknown, missing and future schemas fail closed',
  module.index(null) === null && module.index({ schema: 'data-grid-gb.map-click-network.v2' }) === null);

const fixture = {
  schema: 'data-grid-gb.map-click-network.v1',
  connection_points: [{
    site_code: 'COTT', name: 'COTTAM', transmission_owner: 'NGET', voltages_kv: [400],
    location: { lat: 53.300747, lon: -0.781375, matched_by: 'exact_name_highest_voltage' },
    fault_current_by_voltage: {
      '400': { peak: { voltages_kv: [400], metrics: {
        three_phase_rms_break_current_ka: { min: 38.13, max: 50.61, unit: 'kA' }
      } } }
    },
    existing_circuits: [
      { local_node: 'COTT41', remote_node: 'WBUR42', local_voltage_kv: 400,
        remote_voltage_kv: 400, impedance_pct_100mva: { r: 0.1, x: 1, b: 8 },
        seasonal_rating_mva: { winter: 3326, spring: 3000, summer: 2500, autumn: 3000 } },
      { local_node: 'COTT31', remote_node: 'UNKNOWN', local_voltage_kv: null,
        remote_voltage_kv: null, impedance_pct_100mva: { r: 1, x: 2, b: 3 },
        seasonal_rating_mva: { winter: 100, spring: null, summer: null, autumn: null } }
    ],
    planned_changes: [{ local_node: 'COTT41', remote_node: 'MARH4B',
      local_voltage_kv: 400, remote_voltage_kv: 400, year: '2028', status: 'Change' }],
    transformers: [], reactive_compensation: [{ connection_kv: 400, type: 'Reactor' }],
    interconnectors: [], projection_reconciliation: {
      planned_changes_published: 17, planned_change_appearances: 16,
      unresolved_planned_change_appearances: 1
    }
  }]
};
const index = module.index(fixture);
check('a recognised product indexes', index?.points === 1);
check('unknown and empty identities return null', index.at('NOPE') === null && index.at('') === null);
const noVoltage = index.at('COTT');
check('no declared voltage means no mixed electrical rows are returned',
  noVoltage.connection_voltage_kv === null && noVoltage.fault_current === null
  && noVoltage.existing_circuits.length === 0 && noVoltage.planned_changes.length === 0);
const cottam = index.at('COTT', { connectionKv: 400 });
check('the declared 400 kV voltage selects only its published fault scope',
  cottam.fault_current.peak.voltages_kv.length === 1
  && cottam.fault_current.peak.voltages_kv[0] === 400);
check('the undeclared-voltage circuit is refused rather than decoded from COTT31',
  cottam.existing_circuits.length === 1 && cottam.existing_circuits[0].local_node === 'COTT41');
check('planned changes are filtered by explicit local voltage too',
  cottam.planned_changes.length === 1 && cottam.planned_changes[0].local_voltage_kv === 400);
check('reactive equipment uses its explicit connection voltage',
  cottam.reactive_compensation.length === 1);
check('reconciliation gaps travel with the useful answer',
  cottam.reconciliation.unresolved_planned_change_appearances === 1);
check('the refusal travels beside every answer', /not solved power flow/.test(cottam.not_an_assessment)
  && /available headroom/.test(cottam.not_an_assessment)
  && /connection assessment/.test(cottam.not_an_assessment));
check('the module contains no voltage decoder or impedance arithmetic',
  !/slice\(|substring\(|charAt\(|parseInt\(/.test(source)
  && !/Math\.(sqrt|hypot|atan|asin)/.test(source));
check('the module does not fetch, render or measure',
  !/fetch\(|innerHTML|distanceKm|haversine|6378|6371/.test(source));

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) process.exit(1);
console.log('the click consumer selects explicit voltage-scoped published facts and refuses inference.');
