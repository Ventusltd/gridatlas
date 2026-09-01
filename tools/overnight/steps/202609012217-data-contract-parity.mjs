/**
 * Step: the manifest tells the truth about what the bytes fetch.
 *
 * Codex held v9.65 at 202609011820 and v9.68 at 202609012205 on the same
 * finding, and the finding is right: atlas/current.json has declared
 * derived/connection-points.v2.json (schema v2) for the substation-
 * intelligence cartridge since v9.63, while the cartridge's own bytes have
 * required connection-points.v3 since v9.65, and the same entry listed both
 * "v2-consumed" and "v3-consumed". Every composition manifest since is
 * derived from that entry, so every one of them inherits the lie. And the
 * sld-sandbox entry declared nothing at all while its bytes fetch two
 * products (the transmission network, the price rollup).
 *
 * Nothing shipped is amended. This generation:
 *   - corrects the two entries in current.json, records why and since when;
 *   - brings a data-contract parity proof that reads every cartridge's
 *     bytes for the Ventusltd products it names and the schema it requires,
 *     and fails unless the entry declares exactly those - both directions;
 *   - succeeds the source-registry module so the registry itself states,
 *     for each fetching source, the product and schema it REQUIRES, in
 *     every state, not only the loaded one; and registers the GB price
 *     rollup, which the sandbox has fetched since v9.41 without a row;
 *   - gives the sandbox body a loader state for that rollup on the window
 *     (idle / loading / withheld / failed / ready), as the topology loader
 *     already has, and names the schema the topology loader requires
 *     before the fetch;
 *   - puts the parity proof and every module proof into local CI, and
 *     makes an absent CI gate a failure rather than a line in yellow.
 */

const BODY = 'atlas/parts/202609012045-sld-sandbox-body.js';
const OLD_REGISTRY = 'atlas/modules/202609012135-source-registry.js';
const NEW_REGISTRY = 'atlas/modules/202609012217-source-registry.js';
const REGISTRY_PROOF = 'tools/proofs/modules/202609012217-source-registry.proof.mjs';
const PARITY_PROOF = 'tools/proofs/202609012214-data-contract-parity.proof.mjs';
const CI = 'tools/ci/202609012200-local-ci.mjs';
const CURRENT = 'atlas/current.json';

export default {
  id: 'data-contract-parity',
  version: 'v9.70',
  scope: 'the composition manifest is proven against the bytes: substation-intelligence declares connection-points.v3 as it has required since v9.65 (the entry said v2 from v9.63 until this cut), sld-sandbox declares the transmission network and the price rollup it fetches, a data-contract parity proof holds every entry to its bytes in both directions, the source registry states what each fetching source requires in every state and registers the GB conditions loader, whose state the sandbox now publishes',
  note: 'the manifest is held to the bytes: connection-points v3 declared as consumed, every fetched product declared with its schema, and a parity gate so no generation inherits a false contract again',
  brings: [REGISTRY_PROOF, PARITY_PROOF],
  replaceModules: [`${OLD_REGISTRY}=${NEW_REGISTRY}`],
  proofs: [REGISTRY_PROOF],
  /* the parity proof reads the composition manifest, which exists for this
     generation only after recompose has cut it */
  postProofs: [PARITY_PROOF],
  apply({ read, write, patch }) {
    /* ── 1. the source registry, succeeded ──────────────────────────── */
    let registry = read(OLD_REGISTRY);
    const once = (from, to) => {
      const n = registry.split(from).length - 1;
      if (n !== 1) throw new Error(`registry anchor found ${n} times: ${from.slice(0, 50)}`);
      registry = registry.replace(from, () => to);
    };
    once(` * Successor to 202609012245 at generation 202609012135: the network-topology probe
 * reads the loader state, not the module's existence, and the declared-
 * connections probe reads the module that now holds the table.
`, ` * Successor to 202609012135 at generation 202609012217: every source that
 * fetches a product declares what it REQUIRES (repository, product, schema)
 * and the survey carries that in every state, because a contract stated
 * only once the load has succeeded is no help to the reader of a failure.
 * The GB price rollup, fetched since v9.41 without a row here, is
 * registered with the loader state the sandbox now publishes.
`);
    once(`      id: 'neso-connection-points',
      surface: '__GRIDATLAS_NETWORK__',
`, `      id: 'neso-connection-points',
      surface: '__GRIDATLAS_NETWORK__',
      requires: { repository: 'Ventusltd/data-grid-gb',
        product: 'derived/connection-points.v3.json',
        schema: 'data-grid-gb.connection-points.v3' },
`);
    once(`      id: 'network-topology',
      surface: '__GRIDATLAS_MODULES__.networkTopology + __GRIDATLAS_TOPOLOGY__',
`, `      id: 'network-topology',
      surface: '__GRIDATLAS_MODULES__.networkTopology + __GRIDATLAS_TOPOLOGY__',
      requires: { repository: 'Ventusltd/data-grid-gb',
        product: 'derived/gb-transmission-network.v1.json',
        schema: 'data-grid-gb.transmission-network.v1' },
`);
    once(`      probe: (w) => (w.__GRIDATLAS_MODULES__?.declaredConnections?.count > 0 ? 'ready' : 'absent'),
      detail: (w) => ({ records: w.__GRIDATLAS_MODULES__?.declaredConnections?.count || null })
    }
  ];
`, `      probe: (w) => (w.__GRIDATLAS_MODULES__?.declaredConnections?.count > 0 ? 'ready' : 'absent'),
      detail: (w) => ({ records: w.__GRIDATLAS_MODULES__?.declaredConnections?.count || null })
    },
    {
      id: 'gb-electricity-conditions',
      surface: '__GRIDATLAS_GB_CONDITIONS__',
      contributes: 'the GB wholesale price context a project card carries: '
        + 'negative-price days and the record daily mean, from the owner rollup',
      requires: { repository: 'Ventusltd/data-gb-electricity',
        product: 'derived/price-decade-rollup.json',
        schema: 'data-gb-electricity.price-decade-rollup.v2' },
      /* Withheld is its own state: the product was reached and was not the
         schema this consumer answers, so the panel shows nothing and says
         why. That is neither a failure of the network nor a source ready. */
      probe: (w) => {
        const loader = w.__GRIDATLAS_GB_CONDITIONS__;
        if (!loader) return 'absent';
        if (loader.state === 'ready') return 'ready';
        if (loader.state === 'loading') return 'loading';
        if (loader.state === 'failed') return 'failed to load';
        if (loader.state === 'withheld') return 'withheld: ' + String(loader.reason || 'schema not supported');
        return 'idle, loads on first use';
      },
      detail: (w) => ({ schema: w.__GRIDATLAS_GB_CONDITIONS__?.schema || null,
        renders: w.__GRIDATLAS_GB_CONDITIONS__?.renders || 0 })
    }
  ];
`);
    once(`      return { id: source.id, surface: source.surface,
        contributes: source.contributes, state, ready: state === READY, detail };
`, `      return { id: source.id, surface: source.surface,
        contributes: source.contributes, requires: source.requires || null,
        state, ready: state === READY, detail };
`);
    write(NEW_REGISTRY, registry);

    /* ── 2. the body: loader states on the window ───────────────────── */
    patch(BODY, [
      [`  const topology = { state: 'idle', product: TOPOLOGY_PRODUCT, schema: null,
    bytes: null, sites: null, index: null, error: null,
    started_at: null, ready_at: null, blocks_filled: 0 };
`, `  const topology = { state: 'idle', product: TOPOLOGY_PRODUCT, schema: null,
    schema_required: topologyModule()?.accepts || null,
    bytes: null, sites: null, index: null, error: null,
    started_at: null, ready_at: null, blocks_filled: 0 };
`, 'topology loader names the schema it requires before the fetch'],
      [`  const GB_SCHEMA = 'data-gb-electricity.price-decade-rollup.v2';
`, `  const GB_SCHEMA = 'data-gb-electricity.price-decade-rollup.v2';
  /* Loader state on the window, as the topology loader's is, so the source
     registry can say whether this product answered, was withheld (reached,
     not the schema this consumer answers) or failed - generation 202609012217. */
  const gbLoader = { state: 'idle', product: GB_ROLLUP, schema_required: GB_SCHEMA,
    schema: null, reason: null, error: null, renders: 0 };
  window.__GRIDATLAS_GB_CONDITIONS__ = gbLoader;
`, 'GB conditions loader state'],
      [`  async function renderGbConditions(body) {
    let product = null;
    try {
`, `  async function renderGbConditions(body) {
    let product = null;
    gbLoader.state = 'loading';
    try {
`, 'GB loader: loading'],
      [`    } catch (error) {
      product = null;
    }
    if (!product) {
      body.innerHTML = '<p class="gb-note">The price rollup could not be '
`, `    } catch (error) {
      product = null;
      gbLoader.error = String(error && error.message || error);
    }
    if (!product) {
      gbLoader.state = 'failed';
      body.innerHTML = '<p class="gb-note">The price rollup could not be '
`, 'GB loader: failed'],
      [`    const productError = gbProductError(product);
    if (productError) {
`, `    const productError = gbProductError(product);
    if (productError) {
      gbLoader.state = 'withheld';
      gbLoader.reason = productError;
      gbLoader.schema = product.schema || null;
`, 'GB loader: withheld'],
      [`    link.gb_conditions = {
      reached: true,
      schema_supported: true,
`, `    gbLoader.state = 'ready';
    gbLoader.schema = product.schema;
    gbLoader.renders += 1;
    link.gb_conditions = {
      reached: true,
      schema_supported: true,
`, 'GB loader: ready'],
    ]);

    /* ── 3. current.json: the entries say what the bytes fetch ──────── */
    const current = JSON.parse(read(CURRENT));
    const substation = current.cartridges.find(c => c.id === 'substation-intelligence');
    const sandbox = current.cartridges.find(c => c.id === 'sld-sandbox');
    if (!substation || !sandbox) throw new Error('current.json lacks the entries this step corrects');
    if (substation.data_source.product !== 'derived/connection-points.v2.json') {
      throw new Error('substation-intelligence no longer declares v2; this step is stale');
    }
    substation.data_source.product = 'derived/connection-points.v3.json';
    substation.data_source.schema_required = 'data-grid-gb.connection-points.v3';
    substation.data_source.corrected_at = {
      generation: '202609012217',
      finding: 'the entry declared connection-points.v2 from v9.63 (202609012045) to v9.69 while the cartridge bytes required v3 from v9.65; held by Codex at 202609011820 and 202609012205',
      proof: PARITY_PROOF
    };
    substation.capabilities = substation.capabilities.filter(c => c !== 'neso-etys-connection-points-v2-consumed');
    if (!substation.capabilities.includes('connection-points-v3-consumed')) substation.capabilities.push('connection-points-v3-consumed');
    sandbox.data_sources = [
      { repository: 'Ventusltd/data-grid-gb',
        product: 'derived/gb-transmission-network.v1.json',
        schema_required: 'data-grid-gb.transmission-network.v1',
        fetched: 'on the first click that asks, never at load; indexed by the network-topology module',
        upstream: 'NESO Electricity Ten Year Statement 2025, appendix B' },
      { repository: 'Ventusltd/data-gb-electricity',
        product: 'derived/price-decade-rollup.json',
        schema_required: 'data-gb-electricity.price-decade-rollup.v2',
        fetched: 'when a project card opens its GB conditions panel; revalidated with no-cache every open',
        upstream: 'Elexon settlement prices as the owner repository publishes them' }
    ];
    write(CURRENT, `${JSON.stringify(current, null, 1)}\n`);

    /* ── 4. local CI carries every proof, and an absent gate is red ─── */
    patch(CI, [
      [`  ['source registry', ['tools/proofs/modules/202609012135-source-registry.proof.mjs']],
  ['map-click network', ['tools/proofs/modules/202609012230-map-click-network.proof.mjs']],
  ['declared connections', ['tools/proofs/modules/202609012130-declared-connections.proof.mjs']]
];`, `  ['source registry', ['tools/proofs/modules/202609012217-source-registry.proof.mjs']],
  ['map-click network', ['tools/proofs/modules/202609012230-map-click-network.proof.mjs']],
  ['declared connections', ['tools/proofs/modules/202609012130-declared-connections.proof.mjs']],
  ['sizing arithmetic', ['tools/proofs/modules/202609012205-sizing-arithmetic.proof.mjs']],
  ['data-contract parity', ['tools/proofs/202609012214-data-contract-parity.proof.mjs']]
];`, 'CI gate list'],
      [`  if (!existsSync(join(GRIDATLAS, args[0]))) {
    console.log(\`  \\x1b[33m\${name.padEnd(22)} absent\\x1b[0m  \${args[0]}\`);
    continue;
  }`, `  if (!existsSync(join(GRIDATLAS, args[0]))) {
    /* an absent gate was a yellow line and a continue until 202609012217;
       a skip is not a pass, so it is red and counted */
    console.log(\`  \\x1b[31m\${name.padEnd(22)} ABSENT\\x1b[0m  \${args[0]}\`);
    flaws.push(\`gate absent: \${name} (\${args[0]})\`);
    report.gates[name] = { ok: false, summary: 'absent' };
    continue;
  }`, 'absent gate is red'],
    ]);
  }
};
