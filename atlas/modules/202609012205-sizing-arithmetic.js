/**
 * Module: sizing-arithmetic
 *
 * The screening arithmetic of the SLD sandbox: physical inputs to array
 * statistics, the three named ratios (design, export, headroom), the
 * string and central topologies with their corrected nameplates, the
 * finance port of gis-sld-v5-finance.js, and the two-variable fit that
 * lands a layout on the capacity the register states.
 *
 * Lifted out of the sld-sandbox body at generation 202609012205 (UTC),
 * expression for expression. The body closed over its state object and
 * its finance defaults; here both are parameters. Nothing else changed,
 * and the parity proof evaluates the last inline copy beside this module
 * on the same inputs and asserts identical values.
 *
 * WHAT IT WILL NOT DO
 * It grades nothing. A ratio below one is stated with its meaning; an
 * export set by the transformers is stated as the design fact it is. The
 * finance figures are a screening model with the reference's own inputs
 * and are labelled as such by the panel that shows them.
 *
 * Pure. No DOM, no network, no state of its own: fitToStatedCapacity
 * mutates the state object it is handed, as the body's did, and says so.
 */
(() => {
  const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
  if (NS.sizingArithmetic) return;


  function physicalInputs(inputs) {
    const i = inputs;
    if (i.mode === 'central') {
      return {
        mod_wp: i.mod_wp_c, mod_l: i.mod_l_c, mod_w: i.mod_w_c,
        gcr: i.gcr_c, gross_factor: i.gross_factor_c,
      };
    }
    return {
      mod_wp: i.mod_wp, mod_l: i.mod_l, mod_w: i.mod_w,
      gcr: i.gcr, gross_factor: i.gross_factor,
    };
  }

  function buildStats(inputs, o) {
    const p = physicalInputs(inputs);
    const dcMwp = (o.module_count * p.mod_wp) / 1e6;
    const acMw = o.ac_mw_direct != null ? o.ac_mw_direct
      : (o.dc_ac_ratio > 0 ? dcMwp / o.dc_ac_ratio : 0);
    const netModArea = o.module_count * p.mod_l * p.mod_w;
    const netArrayArea = p.gcr > 0 ? netModArea / p.gcr : 0;
    return {
      total_blocks: o.total_blocks,
      module_count: o.module_count,
      dc_mwp: dcMwp,
      ac_mw: acMw,
      dc_ac_ratio: acMw > 0 ? dcMwp / acMw : o.dc_ac_ratio,
      net_array_area_m2: netArrayArea,
      gross_site_area_m2: netArrayArea * p.gross_factor,
      block_ground_area_m2: o.total_blocks > 0 ? netArrayArea / o.total_blocks : 0,
      production_substation_ac_mva: o.production_substation_ac_mva || 0,
      ring_main_ac_mva: o.ring_main_ac_mva || 0,
      warning: o.warning || 'Check skid rating, transformer rating, cable ratings, protection, losses and grid compliance.'
    };
  }

  /* Three numbers that must agree, and did not.
     ----------------------------------------------------------------------
     Measured on the shipped defaults, the panel produced three different
     values for one quantity:

       string   stated DC/AC input        1.200
                reported DC/AC            1.040
                implied by the hardware   0.945

     A DC/AC ratio below one is not a design choice, it is a contradiction: it
     says the array is smaller than the inverters it feeds, which nobody
     builds. And in central mode the reported ratio was 2.402 against an
     inverter ratio of 1.200 — exactly double, because AC had correctly become
     the LIMITING nameplate (the transformers) while the ratio was still being
     read as though it were the inverter nameplate. Both numbers were right
     about different things and both were called DC/AC.

     There are three distinct quantities here and the panel now keeps them
     apart by name:

       DC          the array, MWp
       inverter AC the inverters can convert, MW
       export      the smaller of the inverters and the transformers, MVA

     The DESIGN ratio is DC over inverter AC, which is the number the industry
     means by DC/AC and the one a stated 1.2 refers to. The EXPORT ratio is DC
     over the export limit, which is what determines clipping and curtailment.
     Reporting one of them under the other's name is how a plant ends up
     described as 2.4 when it was specified as 1.2.

     Nothing here changes a layout. It changes what the numbers are called, and
     says so out loud when they disagree with each other. */
  /* There was an auto-reconciler here. It is deleted, not disabled.
     ----------------------------------------------------------------------
     It computed a "consistent" strings-per-inverter count from the stated
     DC/AC ratio and assigned it to sld.inputs.z_strings, on the reasoning that
     the original's 18 gives a block DC/AC of 0.945 and that nobody builds an
     array smaller than its own inverters. That reasoning was wrong: the
     reference documents 28 string inverters at 352 kVA making 9,856 kVA ahead
     of an 8.96 MVA skid, and the oversizing is the design.

     The default was reverted, and the reconciler was left behind uncalled.
     Flagged by the Codex source gate as a stop-ship, and it was right. Dead
     code that ASSIGNS to a reference input is not inert: it is one future
     handler away from silently rewriting the design this cartridge exists to
     reproduce, and it would do so quietly, in a place nobody would look.

     This is the same lesson as the dead .grid-cell grading CSS removed from
     Pipeline News earlier tonight — a rule with no caller is one edit from
     having one — and I repeated the mistake within hours of writing it down.
     Deleted rather than commented out, for the same reason. */


  function consistency(inputs, stats) {
    const i = inputs;
    const string = i.mode === 'string';

    const inverterAcMw = string
      ? (stats.total_blocks * i.y_invs * i.string_inv_kva) / 1000
      : stats.total_blocks * i.inv_ac_mw_c;
    const skidAcMva = string
      ? stats.total_blocks * i.string_skid_mva
      : (i.mv_per_ring_c * i.rings_c) * i.central_skid_mva_c;
    const exportMva = Math.min(inverterAcMw, skidAcMva);

    /* Three ratios, three names. They describe different pairs of things and
       collapsing them is how a plant specified at 1.2 gets reported as 2.4.

         design    array DC MWp / inverter AC MW    what "DC/AC" means
         export    array DC MWp / export MVA        what drives clipping
         headroom  inverter AC MW / export MVA      how hard the inverters are
                                                    pushed against their skids

       The third is the one that says whether the inverters are oversized
       against the transformers, and in this design they deliberately are. */
    const designRatio = inverterAcMw > 0 ? stats.dc_mwp / inverterAcMw : null;
    const exportRatio = exportMva > 0 ? stats.dc_mwp / exportMva : null;
    const headroomRatio = exportMva > 0 ? inverterAcMw / exportMva : null;
    const statedRatio = string ? Number(i.dc_ac_ratio) : (
      i.inv_ac_mw_c > 0 ? i.inv_dc_mw_c / i.inv_ac_mw_c : null);

    const notes = [];
    /* Descriptive, not a verdict.
       An earlier version of this called a design ratio below one a
       contradiction that "nobody builds". That was wrong about this design:
       the reference sandbox documents 28 string inverters at 352 kVA making
       9,856 kVA ahead of an 8.96 MVA skid, and oversizing inverters against
       the transformer is a deliberate choice, not an arithmetic fault. The
       panel states the number and what it means; it does not grade it. */
    if (Number.isFinite(designRatio) && designRatio < 1) {
      notes.push('Array DC divided by inverter AC is ' + designRatio.toFixed(2)
        + ' from the module, string and inverter counts shown.');
    }
    // The stated ratio is an instruction. If the hardware does not honour it,
    // the hardware is what will be built.
    if (Number.isFinite(designRatio) && Number.isFinite(statedRatio)
        && statedRatio > 0 && Math.abs(designRatio - statedRatio) / statedRatio > 0.05) {
      notes.push('Stated DC/AC ' + statedRatio.toFixed(2) + ', but the module '
        + 'and inverter counts give ' + designRatio.toFixed(2)
        + '. The model displays both and does not rewrite either input.');
    }
    // The transformers, not the inverters, set the export.
    if (Number.isFinite(inverterAcMw) && Number.isFinite(skidAcMva)
        && inverterAcMw > skidAcMva * 1.001) {
      // Stated as the design fact it is, with the ratio, not as a fault.
      notes.push('Inverters total ' + inverterAcMw.toFixed(1) + ' MW against '
        + skidAcMva.toFixed(1) + ' MVA of skid transformer, a ratio of '
        + (headroomRatio || 0).toFixed(2) + '. Export is set by the '
        + 'lower nameplate in this screening model. The connection agreement '
        + 'and electrical design determine the applicable export constraint.');
    }
    return {
      dc_mwp: stats.dc_mwp,
      inverter_ac_mw: inverterAcMw,
      skid_ac_mva: skidAcMva,
      export_mva: exportMva,
      design_dc_ac: designRatio,
      export_dc_ac: exportRatio,
      inverter_to_export: headroomRatio,
      stated_dc_ac: Number.isFinite(statedRatio) ? statedRatio : null,
      notes,
    };
  }

  function stringStats(inputs) {
    const i = inputs;
    if (i.mod_wp <= 0 || i.mod_l <= 0 || i.mod_w <= 0 || i.x_mods <= 0) {
      return buildStats(i, { total_blocks: 0, module_count: 0, dc_ac_ratio: i.dc_ac_ratio });
    }
    const total_blocks = i.b_cols * i.s_subs;
    const module_count = total_blocks * i.y_invs * i.z_strings * i.x_mods;
    const inverterAcMaxMva = (i.y_invs * i.string_inv_kva) / 1000;
    const production = i.string_skid_mva;
    let warning;
    if (inverterAcMaxMva > production) {
      warning = 'Inverter ACmax exceeds the skid transformer rating. Verify temperature rating, overload strategy and clipping assumptions.';
    } else if (i.string_inv_kva > 500) {
      warning = 'Large string inverter rating selected. Verify LV switchgear, transformer, cable loading and protection.';
    }
    return buildStats(i, {
      total_blocks, module_count, dc_ac_ratio: i.dc_ac_ratio,
      ac_mw_direct: total_blocks * production,
      production_substation_ac_mva: production,
      ring_main_ac_mva: production * i.s_subs,
      warning
    });
  }

  function centralStats(inputs) {
    const i = inputs;
    if (i.mod_wp_c <= 0 || i.mod_l_c <= 0 || i.mod_w_c <= 0 || i.x_mods_c <= 0) {
      return buildStats(i, { total_blocks: 0, module_count: 0, dc_ac_ratio: 1.2 });
    }
    const strDcKwp = (i.x_mods_c * i.mod_wp_c) / 1000;
    const reqStrings = strDcKwp > 0 ? Math.ceil((i.inv_dc_mw_c * 1000) / strDcKwp) : 0;
    // total_blocks counts INVERTERS: inverters per MV skid, times skids per
    // ring, times rings. The skids are the level above it.
    const total_blocks = i.inv_per_mv_c * i.mv_per_ring_c * i.rings_c;
    const skid_count = i.mv_per_ring_c * i.rings_c;
    const module_count = reqStrings * i.x_mods_c * total_blocks;

    /* Two nameplates, and they are not the same number.
       --------------------------------------------------------------------
       The inverters and the MV skid transformers they share are rated
       separately, and the plant can export no more than the smaller of the
       two. On the shipped defaults they are a factor of two apart: 24
       inverters at 4.4 MW is 105.6 MW of inverter, sitting on 12 skids at
       4.4 MVA, which is 52.8 MVA of transformer.

       The figure shown was 211.2 MW -- neither of those, and larger than
       both. `total_blocks` already contains `inv_per_mv_c`, and the AC line
       multiplied by it a second time, so the count of inverters sharing a
       skid entered the answer squared. It also multiplied a count of
       inverters by a TRANSFORMER rating, which is not a quantity that
       exists.

       This is a deliberate divergence from the sandbox this was ported from.
       gis-sld-v5-calculations.js line 147 computes the same expression, so
       the fault is in the original and was carried across faithfully by a
       port whose whole contract was to carry the arithmetic unchanged.
       Reported by the Codex session auditing this estate in parallel;
       confirmed here dimensionally and against those defaults. */
    const inverter_ac_total = total_blocks * i.inv_ac_mw_c;
    const skid_ac_total = skid_count * i.central_skid_mva_c;
    const ac_mw_direct = Math.min(inverter_ac_total, skid_ac_total);

    // A skid carries every inverter fed into it, so the comparison that
    // matters is the whole MV block against its transformer, not one
    // inverter against it. One-to-one it never fires; on the defaults the
    // block is 8.8 MW on a 4.4 MVA skid and it should.
    const block_ac_mw = i.inv_ac_mw_c * i.inv_per_mv_c;
    let warning;
    if (block_ac_mw > i.central_skid_mva_c) {
      warning = `The ${i.inv_per_mv_c} inverters on each MV skid total `
        + `${block_ac_mw.toFixed(2)} MW against a skid rated `
        + `${i.central_skid_mva_c} MVA. Export is limited by the transformer, `
        + `not the inverters. Verify thermal rating, overload strategy and `
        + `the export limit in the connection agreement.`;
    } else if (i.inv_ac_mw_c > 10) {
      warning = 'Large central inverter or power block selected. Verify transformer, MV switchgear, harmonics, thermal loading, protection and grid code compliance.';
    }
    return buildStats(i, {
      total_blocks, module_count,
      dc_ac_ratio: i.inv_ac_mw_c > 0 ? i.inv_dc_mw_c / i.inv_ac_mw_c : 1.2,
      ac_mw_direct,
      // One skid's rating. The label on the control is "Skid MVA", so it is
      // the skid, and multiplying it by the inverters on that skid described
      // no piece of equipment.
      production_substation_ac_mva: i.central_skid_mva_c,
      ring_main_ac_mva: i.central_skid_mva_c * i.mv_per_ring_c,
      central_inverter_ac_total: inverter_ac_total,
      central_skid_ac_total: skid_ac_total,
      warning
    });
  }

  const DEVELOPMENT_STAGES = Object.freeze({
    '0.003': 'Land Option Signed',
    '0.015': 'Grid Connection Application Accepted',
    '0.035': 'Planning Application Submitted',
    '0.055': 'Planning Permission Granted',
    '0.070': 'Grid Connection Terms Reviewed and Agreed',
    '0.080': 'Buyer or Revenue Agreement Reviewed (Power Purchase Agreement (PPA) / Offtaker)',
    '0.100': 'Construction Contract Signed and Finance Committed (Financial Close)',
  });

  const financeNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const DEVELOPMENT_SUCCESS = Object.freeze({
    '0.003': 10,
    '0.015': 15,
    '0.035': 30,
    '0.055': 55,
    '0.070': 70,
    '0.080': 80,
    '0.100': 95,
  });

  const BIFACIAL_BY_GCR = Object.freeze({
    '0.35': 8,
    '0.45': 5,
    '0.75': 2,
  });

  /* The original stage selector is not only a label: its change handler sets
     development cost to the selected GBP/Wp value and success probability to
     a stage-specific percentage. Keep that linked behavior explicit so a
     stage change cannot leave the old stage's costs behind. */
  function applyDevelopmentStageDefaults(financeInputs, stageValue) {
    const stage = String(stageValue);
    if (!Object.prototype.hasOwnProperty.call(DEVELOPMENT_STAGES, stage)) return false;
    financeInputs.dev_stage = stage;
    financeInputs.dev_cost_mw = financeNumber(stage);
    financeInputs.dev_success = DEVELOPMENT_SUCCESS[stage];
    return true;
  }

  /* Original Mounting & GCR presets also set the financial bifacial gain.
     Apply the exact three preset mappings to the active topology only. A
     free-form GCR value does not invent a gain. */
  function applyMountingBifacial(financeByMode, mode, gcrValue) {
    const values = (financeByMode || {})[mode];
    if (!values) return false;
    const key = String(Number(gcrValue));
    if (!Object.prototype.hasOwnProperty.call(BIFACIAL_BY_GCR, key)) return false;
    values.bifacial = BIFACIAL_BY_GCR[key];
    return true;
  }

  /* Direct port of gis-sld-v5-finance.js computeFinance(). The original
     executable fixture is the authority, not this comment. The one deliberate
     divergence is inherited from the corrected electrical port: annual OPEX
     uses the corrected central inverter nameplate, so the inv_per_mv > 1 case
     must match the fixture's explicit corrected surplus rather than repeat the
     original AC double-count. Every unaffected output remains exact. */
  function screeningFinance(financeInputs, stats, context) {
    const f = financeInputs || (context && context.defaults) || {};
    const dcMwp = financeNumber(stats?.dc_mwp);
    // The reference's OPEX input is GBP/MWac/year. In string mode its AC
    // quantity is skid-limited export. In central mode, once the known square
    // is removed, it is inverter count x inverter MWac. Do not silently swap
    // that to transformer-limited export: those are separately named values.
    const centralInverterAc = (stats?.mode || (context && context.fallbackMode)) === 'central'
      ? financeNumber(stats?.consistency?.inverter_ac_mw) : 0;
    const acMw = centralInverterAc > 0 ? centralInverterAc : financeNumber(stats?.ac_mw);
    const price = financeNumber(f.price);
    const other = financeNumber(f.other);
    const yieldVal = financeNumber(f.yield);
    const bifacial = financeNumber(f.bifacial);
    const baseLoss = financeNumber(f.losses);
    const deg = financeNumber(f.deg);
    const opexRate = financeNumber(f.opex);
    const epcEx = financeNumber(f.epc_ex);
    const floodRate = financeNumber(f.flood_rate);
    const floodAdder = f.flood ? floodRate : 0;
    const modules = financeNumber(f.modules);
    const otherCapex = financeNumber(f.other_capex);
    const fixedCapex = financeNumber(f.fixed_capex);
    const cont = financeNumber(f.cont);
    const lossExtras = financeNumber(f.loss_dc_string) + financeNumber(f.loss_lv_dc)
      + financeNumber(f.loss_lv_ac) + financeNumber(f.loss_tx) + financeNumber(f.loss_other);
    const totalLoss = baseLoss + lossExtras;
    const bessMw = financeNumber(f.bess_mw);
    const bessMwh = financeNumber(f.bess_mwh);
    const bessCapexRate = financeNumber(f.bess_capex);
    const bessCycles = financeNumber(f.bess_cycles);
    const bessRevenuePerMwh = financeNumber(f.bess_spread);
    const bessEffPercent = financeNumber(f.bess_eff);
    const safeLoss = Math.min(Math.max(totalLoss, 0), 100);
    const safeBessEff = Math.min(Math.max(bessEffPercent / 100, 0), 1);
    const effectiveYield = yieldVal * (1 + bifacial / 100);
    const year1Gen = dcMwp * effectiveYield * (1 - safeLoss / 100);
    let gen25 = 0;
    let gen35 = 0;
    for (let year = 1; year <= 35; year += 1) {
      const generation = year1Gen * Math.pow(1 - deg / 100, year - 1);
      if (year <= 25) gen25 += generation;
      gen35 += generation;
    }
    const annualSolarRevenue = year1Gen * (price + other);
    const bessAnnualValue = bessMwh * bessCycles * bessRevenuePerMwh * safeBessEff;
    const annualRevenue = annualSolarRevenue + bessAnnualValue;
    const revenue25 = gen25 * (price + other) + bessAnnualValue * 25;
    const revenue35 = gen35 * (price + other) + bessAnnualValue * 35;
    const annualOpex = acMw * opexRate;
    const baseCapexWp = epcEx + modules + otherCapex + floodAdder;
    const baseCapex = dcMwp * 1_000_000 * baseCapexWp;
    const contingency = baseCapex * (cont / 100);
    const bessCapex = bessMwh * bessCapexRate;
    const totalCapex = baseCapex + contingency + fixedCapex + bessCapex;
    const capexPerWp = dcMwp > 0 ? totalCapex / (dcMwp * 1_000_000) : 0;
    const surplus25 = revenue25 - annualOpex * 25 - totalCapex;
    const surplus35 = revenue35 - annualOpex * 35 - totalCapex;
    const devCostPerMw = financeNumber(f.dev_cost_mw);
    const devModulePerMwp = financeNumber(f.dev_module_mwp);
    const devEpcPerMw = financeNumber(f.dev_epc_mw);
    const devOwnerPerMw = financeNumber(f.dev_owner_mw);
    const devGridPerMw = financeNumber(f.dev_grid_mw);
    const devExitPerMwp = financeNumber(f.dev_exit_mwp);
    const devNpvPerMwp = financeNumber(f.dev_npv_mwp);
    const devSuccessPct = financeNumber(f.dev_success);
    const devYears = financeNumber(f.dev_years);
    const devStage = DEVELOPMENT_STAGES[String(f.dev_stage)] || 'Manual';
    const wpCapacity = dcMwp * 1_000_000;
    const devCapitalAtRisk = wpCapacity * devCostPerMw;
    const devModuleCost = wpCapacity * devModulePerMwp;
    const devEpcCost = wpCapacity * devEpcPerMw;
    const devOwnerCost = wpCapacity * devOwnerPerMw;
    const devGridCost = wpCapacity * devGridPerMw;
    const devTotalBuildCost = devCapitalAtRisk + devModuleCost + devEpcCost
      + devOwnerCost + devGridCost;
    const devExitValue = wpCapacity * devExitPerMwp;
    const devOperatingNpv = wpCapacity * devNpvPerMwp;
    const devGrossMargin = devExitValue - devTotalBuildCost;
    const devRiskAdjustedValue = devGrossMargin * (devSuccessPct / 100);
    const devReturnMultiple = devCapitalAtRisk > 0 ? devGrossMargin / devCapitalAtRisk : 0;
    return {
      annualRevenue, revenue25, revenue35, totalCapex, capexPerWp, surplus25, surplus35,
      devStage, devCostPerMw, devModulePerMwp, devEpcPerMw, devOwnerPerMw,
      devGridPerMw, devExitPerMwp, devNpvPerMwp, devSuccessPct, devYears,
      devCapitalAtRisk, devModuleCost, devEpcCost, devOwnerCost, devGridCost,
      devTotalBuildCost, devExitValue, devOperatingNpv, devGrossMargin,
      devRiskAdjustedValue, devReturnMultiple, price, other, yieldVal, bifacial,
      baseLoss, deg, opexRate, epcEx, floodActive: Boolean(f.flood), floodRate,
      modules, otherCapex, fixedCapex, cont, totalLoss, bessMw, bessMwh,
      bessCapexRate, bessCycles, bessSpread: bessRevenuePerMwh,
      bessEff: bessEffPercent, epcIncModules: epcEx + modules,
    };
  }

  function computeStats(inputs, financeByMode, defaults) {
    const stats = inputs.mode === 'string'
      ? stringStats(inputs) : centralStats(inputs);
    // Same object, so nothing can read a capacity without the check that says
    // whether the capacities agree with each other.
    stats.mode = inputs.mode;
    stats.consistency = consistency(inputs, stats);
    stats.finance = screeningFinance((financeByMode || {})[inputs.mode], stats,
      { fallbackMode: inputs.mode, defaults });
    return stats;
  }

  /**
   * Size the array so its capacity lands on the figure the register states.
   *
   * WHAT IS ADJUSTED, AND WHAT IS NOT
   * Two integer topology counts move -- circuits and skids per circuit in
   * string mode, rings and MV skids per ring in central mode. Everything a
   * supplier fixes stays where the user put it:
   * module rating, string length, inverter and skid ratings. That keeps the
   * result buildable rather than a number reverse-engineered into nonsense.
   *
   * Blocks are integers, so an exact hit is usually impossible. The residual
   * is reported rather than hidden, because a layout that quietly lands 7%
   * off the stated capacity is worse than one that says so.
   *
   * WHICH CAPACITY IS BEING MATCHED
   * That is the caller's declared basis, never a guess. REPD's figure is
   * nominally MWelec, but it is reported inconsistently: some schemes state
   * DC, some AC, and the register does not carry the distinction reliably.
   * Matching AC when the figure was DC oversizes the connection by the DC/AC
   * ratio, which is exactly the error that matters for export limitation.
   */
  /* Fit on two variables, because one cannot reach a small project.
     ----------------------------------------------------------------------
     Reported: the numbers do not change when the headline capacity changes.
     Measured, and they do not:

       string   5, 10, 20, 30, 40, 49.9 and 50 MW all produced 44.80 MW
       central  5, 10 and 20 MW all produced 17.60 MW

     The fit moved ONE variable. In string mode that is b_cols, and because
     total_blocks is b_cols x s_subs with s_subs pinned at five, one step of
     b_cols is five blocks — 44.8 MW at the default skid rating. Nothing below
     that is reachable, so a 30 MW solar farm was drawn as a 44.8 MW one, an
     overstatement of half as much again, and every target under 50 MW
     collapsed onto the same layout. The register starts at 1 MW.

     A block is 8.96 MW in string mode and a skid is 4.4 MVA in central. Those
     are the real quanta, and they are reachable as soon as the inner variable
     is allowed to move too. So the search is over both, and it prefers the
     candidate that stays closest to the shape the user already had — a fit
     that reaches the right capacity by rearranging the whole plant is a worse
     answer than one that reaches it by adding a column.

     Bounds are physical rather than generous: a ring main carries a handful of
     skids, not four hundred, so the inner variable stops at twelve. */
  const FIT_OUTER_MAX = 120;
  const FIT_INNER_MAX = 12;

  function fitToStatedCapacity(sld, computeSldStats) {
    sld.fitResidualPct = null;
    sld.fitQuantumMw = null;
    const target = Number(sld.targetMw);
    if (!Number.isFinite(target) || target <= 0) return;
    if (sld.targetBasis !== 'ac' && sld.targetBasis !== 'dc') return;

    const string = sld.inputs.mode === 'string';
    const outerKey = string ? 'b_cols' : 'rings_c';
    const innerKey = string ? 's_subs' : 'mv_per_ring_c';
    const outer0 = sld.inputs[outerKey];
    const inner0 = sld.inputs[innerKey];

    let best = null;
    for (let inner = 1; inner <= FIT_INNER_MAX; inner += 1) {
      sld.inputs[innerKey] = inner;
      for (let outer = 1; outer <= FIT_OUTER_MAX; outer += 1) {
        sld.inputs[outerKey] = outer;
        const s = computeSldStats();
        const got = sld.targetBasis === 'ac' ? s.ac_mw : s.dc_mwp;
        if (!Number.isFinite(got) || got <= 0) continue;
        const error = Math.abs(got - target);
        // Ties, and near-ties, go to the layout closest to the one already on
        // screen. Without this the fit rearranges the plant for a rounding
        // difference and the drawing jumps for no reason the user can see.
        const drift = Math.abs(inner - inner0) + Math.abs(outer - outer0) / 100;
        if (!best
            || error < best.error - 1e-9
            || (Math.abs(error - best.error) <= 1e-9 && drift < best.drift)) {
          best = { outer, inner, error, got, drift };
        }
      }
    }
    if (!best) {
      sld.inputs[outerKey] = outer0;
      sld.inputs[innerKey] = inner0;
      return;
    }
    sld.inputs[outerKey] = best.outer;
    sld.inputs[innerKey] = best.inner;
    sld.fitResidualPct = ((best.got - target) / target) * 100;

    // What one more block would have added. A residual means nothing without
    // it: 10% off a plant whose smallest step is 9 MW is exact, and 10% off
    // one whose step is 0.5 MW is a miss.
    const oneMore = (() => {
      sld.inputs[outerKey] = best.outer + 1;
      const s = computeSldStats();
      sld.inputs[outerKey] = best.outer;
      const got = sld.targetBasis === 'ac' ? s.ac_mw : s.dc_mwp;
      return Number.isFinite(got) ? Math.abs(got - best.got) : null;
    })();
    sld.fitQuantumMw = oneMore;
  }

  NS.sizingArithmetic = Object.freeze({
    generation: '202609012205',
    DEVELOPMENT_STAGES,
    DEVELOPMENT_SUCCESS,
    BIFACIAL_BY_GCR,
    FIT_OUTER_MAX,
    FIT_INNER_MAX,
    financeNumber,
    physicalInputs,
    buildStats,
    consistency,
    stringStats,
    centralStats,
    applyDevelopmentStageDefaults,
    applyMountingBifacial,
    screeningFinance,
    computeStats,
    fitToStatedCapacity
  });
})();
