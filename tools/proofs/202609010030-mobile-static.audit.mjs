#!/usr/bin/env node

/**
 * Static mobile gate for the composed GridAtlas shell and SLD cartridge.
 * It does not pretend to replace Claude's real browser/device pass; it catches
 * interaction and geometry failures that are already decidable from source.
 *
 * Usage:
 *   node tools/proofs/202609010030-mobile-static.audit.mjs \
 *     [--require-clean] <sld-cartridge.js> <ventus.css> <shell-index.html>
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rawArgs = process.argv.slice(2);
const requireClean = rawArgs.includes("--require-clean");
const args = rawArgs.filter(arg => arg !== "--require-clean");
if (args.length !== 3) {
  console.error("usage: node 202609010030-mobile-static.audit.mjs [--require-clean] <cartridge> <base-css> <shell-html>");
  process.exit(2);
}

function cssBlock(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || "";
}

function px(declarations, property) {
  return Number(declarations.match(new RegExp(`${property}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`))?.[1]);
}

function audit(cartridge, baseCss, shellHtml) {
  const findings = [];

  const mouseOnlySurfaces = [
    ["project card", /bar\.addEventListener\(['"]mousedown['"]/, /bar\.addEventListener\(['"](?:pointerdown|touchstart)['"]/],
    ["layout panel", /heading\.addEventListener\(['"]mousedown['"]/, /heading\.addEventListener\(['"](?:pointerdown|touchstart)['"]/],
    ["array, rotation handle and route pins", /map\.on\(['"]mousedown['"]/, /map\.on\(['"](?:touchstart|pointerdown)['"]/],
  ].filter(([, mouse, touch]) => mouse.test(cartridge) && !touch.test(cartridge)).map(([name]) => name);
  if (mouseOnlySurfaces.length) {
    findings.push({
      code: "MOUSE_ONLY_DRAG_INTERACTIONS",
      detail: `${mouseOnlySurfaces.join("; ")} start only from mousedown; a touch screen cannot begin the claimed drag`,
      surfaces: mouseOnlySurfaces,
    });
  }

  const panel = cssBlock(cartridge, "#${PANEL_ID}");
  const panelTop = px(panel, "top");
  const panelInset = Number(panel.match(/max-height\s*:\s*calc\(100%\s*-\s*(\d+)px\)/)?.[1]);
  const mobilePanel = cartridge.match(/@media\s*\(max-width\s*:\s*700px\)\s*\{#\$\{PANEL_ID\}\s*\{([^}]*)\}/)?.[1] || "";
  const mobileTop = px(mobilePanel, "top");
  if (Number.isFinite(panelTop) && Number.isFinite(panelInset) && panelTop > panelInset) {
    findings.push({
      code: "SLD_PANEL_HEIGHT_OVERRUN",
      detail: "top plus max-height exceeds the map container before content or borders are counted",
      base_overrun_px: panelTop - panelInset,
      mobile_overrun_px: Number.isFinite(mobileTop) ? mobileTop - panelInset : null,
    });
  }

  const cardButton = cssBlock(cartridge, ".gridatlas-card-bar button");
  const panelButtons = cssBlock(cartridge, "#${PANEL_ID} .sld-min,#${PANEL_ID} .sld-close");
  const smallTargets = [];
  for (const [name, block] of [["card minimise/close", cardButton], ["layout minimise/close", panelButtons]]) {
    const width = px(block, "min-width");
    const height = px(block, "height");
    if ((Number.isFinite(width) && width < 24) || (Number.isFinite(height) && height < 24)) {
      smallTargets.push({ name, min_width_px: width, height_px: height });
    }
  }
  if (smallTargets.length) {
    findings.push({
      code: "TOUCH_TARGET_BELOW_24PX",
      detail: "primary panel controls are smaller than even a 24 CSS px compact touch target",
      targets: smallTargets,
    });
  }

  const controls = cssBlock(baseCss, ".map-controls");
  const controlCount = (shellHtml.match(/class="map-ctrl-btn"/g) || []).length;
  const shortQueryAt = baseCss.search(/@media\s*\(max-height\s*:\s*600px\)/);
  const shortRules = shortQueryAt >= 0 ? baseCss.slice(shortQueryAt) : "";
  if (controlCount >= 6 && !/max-height|overflow-y|flex-wrap/.test(controls)
      && !/\.map-controls\s*\{[^}]*?(?:max-height|overflow-y|flex-wrap)/s.test(shortRules)) {
    findings.push({
      code: "LANDSCAPE_CONTROL_STACK_UNBOUNDED",
      detail: `${controlCount} shell buttons plus the injected GB control remain a bottom stack with no short-height bound, scroll or collapse rule`,
      shell_button_count: controlCount,
    });
  }

  const wrapper = cssBlock(baseCss, ".search-bar-wrapper");
  const results = cssBlock(baseCss, ".search-results");
  const searchBottom = px(wrapper, "top") + px(results, "top") + px(results, "max-height");
  if (Number.isFinite(searchBottom)
      && !/@media\s*\(max-height\s*:\s*600px\)[\s\S]*?\.search-results\s*\{/.test(baseCss)) {
    findings.push({
      code: "LANDSCAPE_SEARCH_RESULTS_UNBOUNDED",
      detail: `the fixed search dropdown can extend ${searchBottom}px from the map top and has no short-height override; the map container clips overflow`,
      extent_from_map_top_px: searchBottom,
    });
  }

  if (/Math\.min\(window\.innerWidth\s*-\s*60/.test(cartridge)) {
    findings.push({
      code: "CARD_DRAG_CLAMP_IGNORES_CARD_WIDTH",
      detail: "the free-card x clamp reserves 60px rather than measuring the card, so a dragged card can finish mostly beyond a phone edge",
    });
  }

  return findings;
}

function activeRules(width, height) {
  return [
    width <= 480 ? "shell:max-width-480" : null,
    width <= 700 ? "cartridge:max-width-700" : null,
    height <= 600 ? "shell:max-height-600" : null,
  ].filter(Boolean);
}

// The audit must prove that its principal disease fires and a repaired shape
// is silent before it is trusted against the real candidate.
const disease = `
bar.addEventListener('mousedown', begin);
heading.addEventListener('mousedown', begin);
map.on('mousedown', begin);
#\${PANEL_ID}{top:112px;max-height:calc(100% - 28px)}
@media (max-width:700px){#\${PANEL_ID}{top:96px}}
.gridatlas-card-bar button{min-width:26px;height:22px}
#\${PANEL_ID} .sld-min,#\${PANEL_ID} .sld-close{min-width:24px;height:20px}
Math.min(window.innerWidth - 60, x);
`;
const diseaseCss = `.map-controls{position:absolute}.search-bar-wrapper{top:72px}.search-results{top:36px;max-height:220px}@media (max-height:600px){.hud-header{padding:3px}}`;
const diseaseHtml = new Array(6).fill('<button class="map-ctrl-btn"></button>').join("");
const diseaseCodes = new Set(audit(disease, diseaseCss, diseaseHtml).map(item => item.code));
assert.ok(diseaseCodes.has("MOUSE_ONLY_DRAG_INTERACTIONS"));
assert.ok(diseaseCodes.has("SLD_PANEL_HEIGHT_OVERRUN"));
assert.ok(diseaseCodes.has("LANDSCAPE_CONTROL_STACK_UNBOUNDED"));

const healthy = `
bar.addEventListener('pointerdown', begin);
heading.addEventListener('pointerdown', begin);
map.on('touchstart', begin);
#\${PANEL_ID}{top:112px;bottom:14px;max-height:none}
.gridatlas-card-bar button{min-width:44px;height:44px}
#\${PANEL_ID} .sld-min,#\${PANEL_ID} .sld-close{min-width:44px;height:44px}
Math.min(window.innerWidth - card.getBoundingClientRect().width - 4, x);
`;
const healthyCss = `.map-controls{max-height:70%;overflow-y:auto}.search-bar-wrapper{top:72px}.search-results{top:36px;max-height:220px}@media (max-height:600px){.search-results{max-height:calc(100dvh - 140px)}}`;
assert.deepEqual(audit(healthy, healthyCss, diseaseHtml), []);

const [cartridgePath, cssPath, htmlPath] = args.map(item => path.resolve(item));
const findings = audit(
  fs.readFileSync(cartridgePath, "utf8"),
  fs.readFileSync(cssPath, "utf8"),
  fs.readFileSync(htmlPath, "utf8"),
);

const output = {
  schema: "gridatlas.mobile-static-audit.v1",
  target: {
    cartridge: cartridgePath,
    shell_css: cssPath,
    shell_html: htmlPath,
  },
  viewports: [
    { name: "phone_portrait_390", width: 390, height: 844, active_rules: activeRules(390, 844) },
    { name: "phone_portrait_414", width: 414, height: 896, active_rules: activeRules(414, 896) },
    { name: "phone_landscape_844", width: 844, height: 390, active_rules: activeRules(844, 390) },
  ],
  findings,
  disease_fixture: "FIRES",
  healthy_fixture: "SILENT",
  status: findings.length ? "MOBILE_STATIC_FAILURE" : "CLEAN",
};

console.log(JSON.stringify(output, null, 2));
if (requireClean && findings.length) {
  console.error(`FAIL: ${findings.length} mobile-static findings remain`);
  process.exit(1);
}
