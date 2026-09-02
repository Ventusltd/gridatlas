/**
 * Step: the computation leaves the sandbox, and ownership arrives.
 *
 * THE WALL
 * --------
 * The sld-sandbox cartridge reached 383,614 bytes of a 400,000 byte
 * boundary - 95% - and the next module would have taken it to 400,771.
 * The scope lint refused it, correctly. There was no fifth script slot to
 * put a new cartridge in: the shell loads four scripts and all four are
 * claimed.
 *
 * Two dishonest ways out were available and are recorded here as rejected:
 * raise the 400 kB boundary because my own lane needed it, or leave the
 * module on disk and uncomposed and call the version shipped. I told Codex
 * tonight that neither of us may weaken a shared check to make our own
 * lane pass, three hours before wanting to do it.
 *
 * THE WAY OUT THAT IS ACTUALLY RIGHT
 * ----------------------------------
 * The five network modules - topology, electrical distance, rating
 * envelope, injection response, planned change - were never the sandbox's
 * concern. They read the operator's published network. The cartridge that
 * owns that concern is substation-intelligence, whose own header has said
 * so since 202609012045: *"the sandbox owns the card, this owns the
 * computation."* The modules were simply in the wrong cartridge, and the
 * boundary is what made that visible.
 *
 * substation-intelligence loads at line 138 of the shell and the sandbox
 * adapter at line 139, so a module composed there is defined before the
 * body that calls it. Moving 67,159 bytes leaves the sandbox at ~316 kB
 * with room to grow, and substation-intelligence at ~170 kB.
 *
 * This is also the modularisation asked for: *"if there are 4000 lines
 * then modularise next versions."* The 4,487-line body stays where it is;
 * what moves is the computation that was never part of it.
 *
 * WHAT THE CUT DOES
 * -----------------
 *   - splits the substation cartridge into its two published halves: the
 *     V8 engine carried verbatim, and PART 2, the intelligence itself;
 *   - gives it a parts manifest, which it should always have had - the
 *     assembler's own docstring uses this exact cartridge as its example;
 *   - moves the five network modules across, and lands owner-boundary
 *     there too, where it belongs;
 *   - restamps BOTH cartridges in one generation, because a composition
 *     where the modules exist twice, or in neither, is not shippable.
 */

const OWNER_MODULE = 'atlas/modules/202609012350-owner-boundary.js';
const OWNER_PROOF = 'tools/proofs/modules/202609012350-owner-boundary.proof.mjs';
const BODY = 'atlas/parts/202609012045-sld-sandbox-body.js';
const CI = 'tools/ci/202609012200-local-ci.mjs';
const CURRENT = 'atlas/current.json';

const ENGINE = 'atlas/releases/202608300453-atlas-v9/ventus-corev8engine.js';
const SUB_BODY = 'atlas/parts/202609012350-substation-intelligence-body.js';
/* A SEED, deliberately not under atlas/manifests/. A manifest there is a
   record of how a shipped generation was actually built; back-dating one
   that cannot reproduce its own cartridge byte-for-byte would be a false
   record of exactly the kind this estate keeps finding. This is an input
   to this cut, and the manifest the cut writes is stamped with the new
   generation and does reproduce its cartridge, because it built it. */
const SUB_SEED = 'atlas/parts/202609012350-substation-intelligence-seed-parts.json';
const SUB_CARTRIDGE = 'atlas/cartridges/202609012045-substation-intelligence-v9-63.js';

/* The five that read the published network, and the new sixth. */
const MOVING = [
  /* Geodesy moves as well, and this is the definitive close of the
     duplicate-geodesy class. The substation body has computed distance
     with 2*R*asin(sqrt(a)) since 202609012045 while the estate's canonical
     form is R*2*atan2(sqrt(a),sqrt(1-a)); the two agree algebraically and
     differ in the last place. It was invisible while that half of the
     cartridge was a monolith, and the all-versions proof found it the
     moment this cut extracted it into a part. Moving geodesy into the
     FIRST-loading cartridge means one implementation serves both, rather
     than the two agreeing by inspection. */
  'atlas/modules/202609011950-geodesy.js',
  'atlas/modules/202609012245-network-topology.js',
  'atlas/modules/202609012245-electrical-distance.js',
  'atlas/modules/202609012250-rating-envelope.js',
  'atlas/modules/202609012320-injection-response.js',
  'atlas/modules/202609012345-planned-change.js',
];

export default {
  id: 'owner-boundary',
  version: 'v9.76',

  restamp: ['substation-intelligence', 'sld-sandbox'],

  scope: 'the computation moves to the cartridge that owns it: the five modules that read the operator\'s published network leave the sandbox for substation-intelligence, which is split into the two halves it has always been - the V8 engine carried verbatim and the intelligence itself - and gains the parts manifest it should always have had; the sandbox drops from 95% of its 400 kB boundary to about 79%, and the new owner-boundary module lands beside its siblings, naming which transmission owners the assets at a site belong to and where two of them meet on one circuit',

  note: 'the boundary refused the cut and it was right to. Raising it, or leaving the module uncomposed and calling the version shipped, were both available and both rejected. substation-intelligence loads before the sandbox adapter in the shell, so a module composed there is defined before the body that calls it.',

  brings: [OWNER_MODULE, OWNER_PROOF],

  /* Everything that moves, plus the new one, into substation-intelligence;
     the five that moved, out of the sandbox. Scoped by cartridge id, which
     is why recompose learned `id=path` for this cut. */
  addModules: [...MOVING, OWNER_MODULE].map(p => `substation-intelligence=${p}`),
  removeModules: MOVING.map(p => `sld-sandbox=${p}`),

  partsFrom: [`substation-intelligence=${SUB_SEED}`],

  proofs: [OWNER_PROOF],

  apply({ read, write, sandboxProof }) {
    /* ── 1. split the substation cartridge into its two halves ───────── */
    const lf = (s) => s.split('\r\n').join('\n');
    const engine = lf(read(ENGINE));
    const cartridge = lf(read(SUB_CARTRIDGE));
    const at = cartridge.indexOf(engine);
    if (at < 0) {
      throw new Error('the carried engine is not present verbatim in the substation cartridge; '
        + 'the split cannot be made without guessing where the halves divide');
    }
    const tail = cartridge.slice(at + engine.length);
    const marker = 'PART 2 - the network, as its operator publishes it';
    if (!tail.includes(marker)) {
      throw new Error('the intelligence half does not carry its own PART 2 marker');
    }
    /* PART 2 exactly as it shipped, its leading blank lines trimmed so the
       assembler's own joiner controls the spacing. */
    write(SUB_BODY, tail.replace(/^\n+/, ''));

    /* ── 1b. the substation body delegates its geodesy ───────────────
       Its own copy used the asin form. Replacing it with a delegation is
       the fix the estate already made in the sandbox at v9.67, applied to
       the half that was still a monolith and therefore unexamined. A
       missing module is a hard throw, not a silent fallback: a fallback
       is how two implementations survive. */
    {
      const OWN = [
        '  function distanceKm(lon1, lat1, lon2, lat2) {',
        '    const dLat = (lat2 - lat1) * DEG;',
        '    const dLon = (lon2 - lon1) * DEG;',
        '    const a = Math.sin(dLat / 2) ** 2',
        '      + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;',
        '    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));',
        '  }',
      ].join('\n');
      const subBody = read(SUB_BODY);
      if (subBody.split(OWN).length - 1 !== 1) {
        throw new Error('the substation body does not carry its own haversine in the shape this step expects');
      }
      write(SUB_BODY, subBody.split(OWN).join([
        '  /* ONE geodesy, and it is the module\'s.',
        '     --------------------------------------------------------------',
        '     This carried its own haversine using 2*R*asin(sqrt(a)) while the',
        '     estate canonical form is R*2*atan2(sqrt(a), sqrt(1-a)). They',
        '     agree algebraically and differ in the last place, and the',
        '     difference was invisible for as long as this half of the',
        '     cartridge was a monolith the all-versions scan could not read.',
        '     202609012350 extracted it, the scan found it immediately, and',
        '     the answer is not to retype the right form here but to stop',
        '     having a second implementation at all. */',
        '  const GEODESY = (window.__GRIDATLAS_MODULES__ || {}).geodesy;',
        '  if (!GEODESY) throw new Error("substation-intelligence requires the geodesy module");',
        '  const distanceKm = GEODESY.distanceKm;',
      ].join('
')));
    }

    /* ── 2. the parts seed it should always have had ─────────────────── */
    write(SUB_SEED, JSON.stringify({
      schema: 'gridatlas.cartridge-parts.v1',
      generation: '202609012045',
      note: 'Written at 202609012350, recording how this cartridge was '
        + 'always composed: the shell engine carried verbatim, then the '
        + 'intelligence. It is not a new design - the assembler docstring '
        + 'uses this cartridge as its worked example - it simply was never '
        + 'written down, which is why the computation ended up in the '
        + 'sandbox instead.',
      assembled_from: [
        { role: 'carried_shell_script', path: ENGINE },
        { role: 'part', path: SUB_BODY },
      ],
    }, null, 1) + '\n');

    /* ── 3. current.json needs no hand edit ──────────────────────────
       recompose now sets assembled_from to the manifest it actually
       wrote, so seeding the field here would only race it. */

    /* ── 4. the ownership sentence in the card ───────────────────────── */
    let body = read(BODY);
    const once = (from, to, label) => {
      const n = body.split(from).length - 1;
      if (n !== 1) throw new Error(`anchor found ${n} times: ${label}`);
      body = body.replace(from, () => to);
    };

    once(`  let plannedIndex;`,
      `  let ownerIndex;
  function ownerModule() {
    try { return window.__GRIDATLAS_MODULES__?.ownerBoundary || null; }
    catch (_) { return null; }
  }

  let plannedIndex;`,
      'owner accessor');

    once(`      /* What is published as planned, in its own sentence.`,
      `      /* Who owns what lands here, and whether two owners meet.
         ---------------------------------------------------------------
         Printed before the planned sentence because it is a fact about
         what is there now. A single owner is a small fact; two owners on
         one circuit is a seam, and a connection across a seam involves
         more than one party. */
      const ownership = (() => {
        const mod = ownerModule();
        if (!mod || !topology.parsedProduct) return null;
        try {
          if (ownerIndex === undefined) ownerIndex = mod.index(topology.parsedProduct);
          if (!ownerIndex) return null;
          return ownerIndex.at(point.site_code, kv != null ? { voltageKv: kv } : undefined);
        } catch (_) { return null; }
      })();
      if (ownership && Array.isArray(ownership.owners_present) && ownership.owners_present.length) {
        const owners = ownership.owners_present.map((o) => escapeHtml(String(o)));
        const seams = (ownership.boundary_circuits || []).length
          + (ownership.boundary_transformers || []).length;
        const counts = ownership.counts || {};
        out += caveat(\`<b>Transmission owner\${owners.length === 1 ? '' : 's'}:</b> \`
          + \`\${owners.join(', ')}.\`
          + (seams
            ? \` \${seams} branch\${seams === 1 ? '' : 'es'} here \${seams === 1 ? 'is' : 'are'} \`
              + \`a boundary: the two ends are published under different owners.\`
            : '')
          + (counts.nodes_with_unknown_owner
            ? \` \${counts.nodes_with_unknown_owner} node here publishes no owner and is \`
              + \`reported as unknown, never taken from the site.\`
            : '')
          + (counts.asset_owner_differs_from_both_ends
            ? \` \${counts.asset_owner_differs_from_both_ends} asset carries an owner \`
              + \`matching neither of its ends; that is reported as itself, not as a boundary.\`
            : '')
          + \` Ownership is a published fact about an asset. It is not a statement \`
          + \`about who a project would contract with, which depends on connection \`
          + \`agreements and commercial terms no appendix contains.\`);
        ownerState.answered += 1;
        ownerState.seams += seams;
      }

      /* What is published as planned, in its own sentence.`,
      'ownership sentence');

    once(`  window.__GRIDATLAS_PLANNED__ = plannedState;`,
      `  window.__GRIDATLAS_PLANNED__ = plannedState;

  /* How many cards named an owner, and how many seams they found. */
  const ownerState = { answered: 0, seams: 0 };
  window.__GRIDATLAS_OWNERSHIP__ = ownerState;`,
      'owner state');

    write(BODY, body);

    /* ── 5. the CI carries the new proof ─────────────────────────────── */
    const ci = read(CI);
    const CI_ANCHOR = `  ['planned change', ['tools/proofs/modules/202609012345-planned-change.proof.mjs']]
];`;
    if (ci.split(CI_ANCHOR).length - 1 !== 1) throw new Error('CI gate list anchor is not unique');
    write(CI, ci.replace(CI_ANCHOR,
      `  ['planned change', ['tools/proofs/modules/202609012345-planned-change.proof.mjs']],
  ['owner boundary', ['tools/proofs/modules/202609012350-owner-boundary.proof.mjs']]
];`));

    /* ── 6a. checks that ask "is this module served?" must look at the
       whole composition, not at one cartridge ─────────────────────────
       Eight existing checks assert a module is present, and every one of
       them reads `cartridgeSource` - correct while the sandbox was the
       only cartridge that carried modules, and wrong the moment the
       computation moved. Their INTENT is right and must not be lost: a
       module that is composed into nothing is the v9.67 failure, proven
       46/46 and present in no served cartridge for two generations.

       So they are retargeted rather than deleted or relaxed: a
       `composedSource` is the concatenation of every cartridge the
       composition actually serves, and "is it served?" is asked of that.
       That is a stronger question than the one they were asking, because
       it no longer depends on which cartridge happens to hold the file. */
    {
      const p = read(sandboxProof);
      const ANCHOR = 'const cartridgeSource = await readPublished(CARTRIDGE);';
      if (p.split(ANCHOR).length - 1 !== 1) throw new Error('cartridgeSource anchor is not unique');
      const withComposed = p.replace(ANCHOR, `${ANCHOR}

/* Every cartridge this composition serves, concatenated.
   ------------------------------------------------------------------------
   "Is this module in the served bytes?" is a question about the
   COMPOSITION, not about one cartridge. It was asked of the sandbox alone
   until 202609012350, when the network modules moved to the cartridge that
   owns the network - at which point eight such checks went red for a
   composition that was entirely correct. Asking the composition is the
   question that was always meant. */
const composedSource = (await Promise.all(
  (CURRENT.cartridges || []).map(entry =>
    readPublished(join(REPO, 'atlas', String(entry.path).replace(/^\\.\\//, ''))))
)).join('\\n');`);

      /* Retarget only the named checks, by rewriting the single argument
         they read. A blanket substitution of cartridgeSource would break
         every check that legitimately asks about the sandbox itself. */
      const RETARGET = [
        'the network-topology module is composed into the served bytes',
        'the electrical-distance module is in the served cartridge',
        'the successor topology module ships, not the incumbent',
        'the rating-envelope module is in the served cartridge',
        'the served bytes contain no site total of circuit ratings',
        'the injection-response module is in the served cartridge',
        'the served bytes never read resistance or susceptance into the flow model',
        'the planned-change module is in the served cartridge',
      ];
      let text = withComposed;
      for (const label of RETARGET) {
        const at = text.indexOf(`check('${label}'`);
        if (at < 0) throw new Error(`cannot retarget a check that is not there: ${label}`);
        /* The call ends where the NEXT top-level statement begins, not at
           the first ');' - several of these wrap an IIFE and contain a
           ');' inside their own body, and stopping there rewrote half a
           check and left the other half reading the old variable. */
        const rest = text.slice(at + 6);
        const candidates = ['\ncheck(', '\nconsole.log(', '\n/*', '\nconst ', '\n{']
          .map(marker => rest.indexOf(marker))
          .filter(i => i >= 0);
        if (!candidates.length) throw new Error(`cannot find the end of: ${label}`);
        const end = at + 6 + Math.min(...candidates);
        const call = text.slice(at, end);
        if (!call.includes('cartridgeSource')) {
          throw new Error(`already retargeted or unexpected shape: ${label}`);
        }
        text = text.slice(0, at)
          + call.split('cartridgeSource').join('composedSource')
          + text.slice(end);
      }

      /* One of them changes MEANING, not just target.
         --------------------------------------------------------------
         It asserted the module appears before `const DECLARED = ` in the
         same file, which was how "evaluated before the body that uses it"
         was guaranteed while both lived in one cartridge. They no longer
         do, and a concatenation order is not an evaluation order. What
         guarantees it now is the shell: it loads ventus-corev8engine.js
         at line 138 and the sandbox adapter at line 139, so the cartridge
         holding the modules is evaluated first. That is the fact to
         assert, and it is read from the shell rather than assumed. */
      const ORDER_OLD = "check('the network-topology module is composed into the served bytes',\n"
        + "  /gridatlas\\.module\\.network-topology\\.v1/.test(composedSource)\n"
        + "  && composedSource.indexOf('gridatlas.module.network-topology.v1') < composedSource.indexOf('const DECLARED = '));";
      if (!text.includes(ORDER_OLD)) {
        throw new Error('the network-topology ordering check is not in the shape this step expects');
      }
      text = text.split(ORDER_OLD).join(
        "check('the network-topology module is composed into the served bytes',\n"
        + "  /gridatlas\\.module\\.network-topology\\.v1/.test(composedSource));\n"
        + "check('and in a cartridge the shell evaluates BEFORE the sandbox that calls it', await (async () => {\n"
        + "  /* Concatenation order is not evaluation order. The shell decides,\n"
        + "     so the shell is what is read. */\n"
        + "  const shell = await readFile(join(REPO, 'atlas', 'releases',\n"
        + "    '202608300453-atlas-v9', 'index.html'), 'utf8');\n"
        + "  const holder = (CURRENT.cartridges || []).find(c => c.id === 'substation-intelligence');\n"
        + "  const sandbox = (CURRENT.cartridges || []).find(c => c.id === 'sld-sandbox');\n"
        + "  if (!holder || !sandbox) return false;\n"
        + "  const first = shell.indexOf(holder.replace_script);\n"
        + "  const second = shell.indexOf(sandbox.replace_script);\n"
        + "  return first >= 0 && second >= 0 && first < second;\n"
        + "})());");
      write(sandboxProof, text);
    }

    /* ── 6. the gate ─────────────────────────────────────────────────── */
    const proof = read(sandboxProof);
    const TAIL = 'console.log(`\\n${passed}/${passed + failures.length} checks passed`);';
    if (proof.split(TAIL).length - 1 !== 1) throw new Error('sandbox proof tail anchor is not unique');
    write(sandboxProof, proof.replace(TAIL, [
      "console.log('\\nthe computation left the sandbox, and ownership arrived\\n');",
      '',
      "/* The move is the point of this generation, so it is asserted from both",
      "   sides: the modules must be GONE from the sandbox cartridge and PRESENT",
      "   in the served composition. Checking only one side would pass a",
      "   composition that had lost them entirely. */",
      "check('the five network modules are no longer in the sandbox cartridge',",
      "  !/gridatlas\\.module\\.network-topology\\.v1/.test(cartridgeSource)",
      "  && !/gridatlas\\.module\\.electrical-distance\\.v1/.test(cartridgeSource)",
      "  && !/gridatlas\\.module\\.rating-envelope\\.v1/.test(cartridgeSource)",
      "  && !/gridatlas\\.module\\.injection-response\\.v1/.test(cartridgeSource)",
      "  && !/gridatlas\\.module\\.planned-change/.test(cartridgeSource));",
      "check('the sandbox cartridge is back under the 400 kB boundary with room to spare',",
      "  cartridgeSource.length < 340000, `${cartridgeSource.length} bytes`);",
      "check('the sandbox still CALLS them, from the cartridge that now carries them',",
      "  /window\\.__GRIDATLAS_MODULES__\\?\\.networkTopology/.test(cartridgeSource)",
      "  && /window\\.__GRIDATLAS_MODULES__\\?\\.ownerBoundary/.test(cartridgeSource));",
      "check('the card names the owners present',",
      "  /<b>Transmission owner/.test(cartridgeSource));",
      "check('a seam is named as a seam, with both ends said to differ',",
      "  /the two ends are published under different owners/.test(cartridgeSource));",
      "check('a null owner is reported as unknown and never taken from the site',",
      "  /publishes no owner and is /.test(cartridgeSource)",
      "  && /never taken from the site/.test(cartridgeSource));",
      "check('an asset whose owner matches neither end is kept out of the boundary count',",
      "  /reported as itself, not as a boundary/.test(cartridgeSource));",
      "check('the page refuses the counterparty reading',",
      "  /who a project would contract with/.test(cartridgeSource));",
      "check('the ownership state is published for review',",
      "  /window\\.__GRIDATLAS_OWNERSHIP__ = ownerState;/.test(cartridgeSource));",
      "",
      "/* The other half of the move, read from the served composition rather",
      "   than from this cartridge. */",
      "{",
      "  const composed = JSON.parse(",
      "    await readFile(join(REPO, 'atlas', 'current.json'), 'utf8'));",
      "  const sub = (composed.cartridges || []).find(c => c.id === 'substation-intelligence');",
      "  check('substation-intelligence is assembled from parts, not a monolith',",
      "    !!sub && typeof sub.assembled_from === 'string');",
      "  const subSource = await readFile(",
      "    join(REPO, 'atlas', sub.path.replace(/^\\.\\//, '')), 'utf8');",
      "  check('the five network modules are in the cartridge that owns the network',",
      "    /gridatlas\\.module\\.network-topology\\.v1/.test(subSource)",
      "    && /gridatlas\\.module\\.electrical-distance\\.v1/.test(subSource)",
      "    && /gridatlas\\.module\\.rating-envelope\\.v1/.test(subSource)",
      "    && /gridatlas\\.module\\.injection-response\\.v1/.test(subSource)",
      "    && /gridatlas\\.module\\.planned-change/.test(subSource));",
      "  check('the new owner-boundary module is there too',",
      "    /gridatlas\\.module\\.owner-boundary/.test(subSource));",
      "  check('it still carries the V8 engine verbatim, which is its slot contract',",
      "    subSource.includes('PART 2 - the network, as its operator publishes it'));",
      "  check('it is under the boundary as well',",
      "    subSource.length < 400000, `${subSource.length} bytes`);",
      "}",
      '',
      TAIL
    ].join('\n')));
  }
};
