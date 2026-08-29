export const ATLAS_V9_REPD_ADDRESS_FLYTO_CONTRACT = Object.freeze({
  schema: "gridatlas.cartridge.v1",
  generation: "202608290716",
  activation: "core-registry-plus-explicit-user-query",
  payloadRequests: 0,
  externalGeocoderRequests: 0,
  maximumMounts: 1,
  resultClass: "DIRECT_PROJECT_MATCH",
  proximityEstablishesIdentity: false,
  relationshipLabel: "REPD operator or applicant (as published)"
});

const STOP = new Set(["a", "an", "and", "anybody", "anyone", "are", "at", "being", "built", "by", "can", "farm", "for", "in", "involved", "is", "of", "on", "project", "site", "someone", "the", "there", "who"]);

export function normalizeSearchText(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9/]+/g, " ").trim();
}

export function parseAtlasQuery(raw) {
  const normalized = normalizeSearchText(raw);
  const constructionIntent = /\b(?:build|building|built|construction|constructing)\b/.test(normalized);
  const groups = normalized.split(/\s+/).filter(Boolean).filter(token => !STOP.has(token)).map(token => token.split("/").filter(Boolean)).filter(group => group.length);
  return { raw: String(raw || ""), normalized, groups, constructionIntent };
}

function searchable(record) {
  return normalizeSearchText([record.name, record.repd_address_display, record.repd_postcode_raw, record.repd_postcode, record.county, record.region, record.planning_authority, record.planning_application_reference, record.repd_ref, record.technology, record.repd_technology].filter(Boolean).join(" "));
}

function scoreRecord(record, parsed) {
  const haystack = searchable(record);
  if (!parsed.groups.length || !parsed.groups.every(group => group.some(term => haystack.includes(term.replace(/\s/g, "")) || haystack.includes(term)))) return null;
  const name = normalizeSearchText(record.name);
  const address = normalizeSearchText(record.repd_address_display);
  const postcode = normalizeSearchText(record.repd_postcode).replace(/\s/g, "");
  const county = normalizeSearchText(record.county);
  let score = 0;
  const reasons = new Set();
  for (const group of parsed.groups) {
    const term = group.find(item => haystack.includes(item.replace(/\s/g, "")) || haystack.includes(item)) || group[0];
    const compact = term.replace(/\s/g, "");
    if (String(record.repd_ref) === term) { score += 1000; reasons.add("REPD ID"); }
    if (postcode && postcode === compact) { score += 800; reasons.add("postcode"); }
    if (name === term) { score += 700; reasons.add("project name"); }
    else if (name.startsWith(term) || name.includes(term)) { score += 260; reasons.add("project name"); }
    if (address.includes(term)) { score += 180; reasons.add("official address"); }
    if (county.includes(term)) { score += 130; reasons.add("county"); }
    if (normalizeSearchText(record.planning_authority).includes(term)) { score += 90; reasons.add("planning authority"); }
    if (normalizeSearchText(record.technology + " " + record.repd_technology).includes(term)) { score += 70; reasons.add("technology"); }
  }
  if (parsed.constructionIntent && ["under construction", "awaiting construction", "application submitted"].includes(record.status)) {
    score += record.status === "under construction" ? 160 : record.status === "awaiting construction" ? 120 : 40;
    reasons.add(record.status);
  }
  return { record, score, reasons: [...reasons] };
}

export function rankRepdProjects(records, rawQuery, limit = 20) {
  const parsed = parseAtlasQuery(rawQuery);
  return records.map(record => scoreRecord(record, parsed)).filter(Boolean).sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name) || Number(a.record.repd_ref) - Number(b.record.repd_ref)).slice(0, limit);
}

function text(tag, value, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

export function mountRepdAddressFlyTo({ map, records, root, onSelected = () => {} }) {
  if (!map || !Array.isArray(records) || !root) throw new Error("address fly-to mount contract failed");
  if (root.dataset.mounted === "true") return ATLAS_V9_REPD_ADDRESS_FLYTO_CONTRACT;
  root.dataset.mounted = "true";
  const input = root.querySelector("[data-atlas-query]");
  const button = root.querySelector("[data-atlas-search]");
  const results = root.querySelector("[data-atlas-results]");
  const live = root.querySelector("[data-atlas-live]");
  const run = () => {
    const matches = rankRepdProjects(records, input.value);
    results.replaceChildren();
    live.textContent = `${matches.length} direct REPD project matches`;
    if (!matches.length) {
      results.append(text("p", "No direct official REPD address/project match. Try a postcode, county, planning authority or REPD reference.", "empty-result"));
      return;
    }
    for (const match of matches) {
      const { record } = match;
      const card = document.createElement("article");
      card.className = "result-card";
      card.dataset.resultClass = "DIRECT_PROJECT_MATCH";
      card.append(text("div", "DIRECT PROJECT MATCH · REPD " + record.repd_ref, "result-kicker"));
      card.append(text("h3", record.name));
      card.append(text("p", record.repd_address_display || "Address not supplied by REPD", "result-address"));
      card.append(text("p", [record.repd_postcode || "Postcode not supplied", record.county, record.planning_authority].filter(Boolean).join(" · "), "result-meta"));
      card.append(text("p", `${record.repd_technology || record.technology} · ${record.capacity_mw} MW · ${record.status}`, "result-meta"));
      card.append(text("p", `REPD operator or applicant (as published): ${record.repd_operator_or_applicant || "Not supplied / withheld"}`, "result-applicant"));
      card.append(text("p", `Matched: ${match.reasons.join(", ")}`, "result-reasons"));
      const fly = text("button", "FLY TO PROJECT", "fly-button");
      fly.type = "button";
      fly.addEventListener("click", () => {
        if (![record.longitude, record.latitude].every(Number.isFinite)) return;
        map.flyTo({ center: [record.longitude, record.latitude], zoom: 13, duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1400, essential: false });
        onSelected(record);
      });
      card.append(fly);
      results.append(card);
    }
  };
  button.addEventListener("click", run);
  input.addEventListener("keydown", event => { if (event.key === "Enter") run(); });
  return ATLAS_V9_REPD_ADDRESS_FLYTO_CONTRACT;
}
