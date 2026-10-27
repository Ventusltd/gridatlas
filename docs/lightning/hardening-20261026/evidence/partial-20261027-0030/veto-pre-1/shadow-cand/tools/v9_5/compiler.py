"""Deterministic source transformations for GridAtlas v9.5."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one source marker, found {count}")
    return text.replace(old, new, 1)


def regex_replace_once(text: str, pattern: str, replacement: str, label: str) -> str:
    changed, count = re.subn(pattern, lambda _match: replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one source region, found {count}")
    return changed


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def compile_cartridge(source: str, generation: str) -> str:
    source = replace_once(
        source,
        "  const GEOCODER_BASE = 'https://api.postcodes.io';\n",
        "  const GEOCODER_BASE = 'https://api.postcodes.io';\n"
        "  const GLOBAL_GEOCODER_URL = 'https://nominatim.openstreetmap.org/search';\n",
        "global geocoder constant",
    )
    source = replace_once(
        source,
        "    schema: 'gridatlas.v9-place-postcode-search.v2',\n"
        "    generation: '202608301136',\n"
        "    geocoder: GEOCODER_BASE,\n"
        "    geocoder_requests: 0,\n"
        "    geocoder_failures: [],\n",
        "    schema: 'gridatlas.v9-place-global-search.v3',\n"
        f"    generation: '{generation}',\n"
        "    version: 'v9.5',\n"
        "    geocoder: GEOCODER_BASE,\n"
        "    global_geocoder: GLOBAL_GEOCODER_URL,\n"
        "    geocoder_providers: ['postcodes.io', 'Nominatim / OpenStreetMap'],\n"
        "    geocoder_requests: 0,\n"
        "    global_geocoder_requests: 0,\n"
        "    geocoder_failures: [],\n",
        "search state identity",
    )
    source = replace_once(
        source,
        "      ORDER BY search_score DESC, capacity_mw DESC NULLS LAST, name ASC\n",
        "      ORDER BY search_score DESC, TRY_CAST(repd_ref AS BIGINT) ASC NULLS LAST, capacity_mw DESC NULLS LAST, name ASC\n",
        "deterministic REPD tie-break",
    )
    source = replace_once(source, "            kind: 'postcode',\n", "            kind: 'postcode',\n            provider: 'postcodes.io',\n", "postcode provider")
    source = replace_once(source, "            kind: 'postcode_district',\n", "            kind: 'postcode_district',\n            provider: 'postcodes.io',\n", "outcode provider")
    source = replace_once(source, "          kind: 'place',\n", "          kind: 'place',\n          provider: 'postcodes.io',\n", "UK place provider")

    global_lane = r'''
  async function queryGlobalGazetteer(query) {
    const raw = String(query ?? '').trim();
    if (raw.length < 2) return [];
    const compact = normaliseCompact(raw);
    if (FULL_POSTCODE.test(compact) || OUTCODE.test(compact)) return [];
    state.global_geocoder_requests += 1;
    try {
      const url = new URL(GLOBAL_GEOCODER_URL);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', '8');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('accept-language', 'en');
      url.searchParams.set('q', raw);
      const response = await fetch(url, {
        cache: 'default',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`Nominatim ${response.status}`);
      const body = await response.json();
      const out = [];
      for (const row of Array.isArray(body) ? body : []) {
        const longitude = Number(row.lon);
        const latitude = Number(row.lat);
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
        const display = String(row.display_name || '').trim();
        const label = String(row.name || row.address?.city || row.address?.town || row.address?.village || display.split(',')[0] || raw).trim();
        out.push({
          kind: 'global_place',
          provider: 'Nominatim / OpenStreetMap',
          label,
          sublabel: display || raw,
          longitude,
          latitude
        });
      }
      return out;
    } catch (error) {
      state.geocoder_failures.push({
        query: raw,
        path: GLOBAL_GEOCODER_URL,
        provider: 'Nominatim / OpenStreetMap',
        message: String(error?.message || error)
      });
      console.warn('[V9.5 GLOBAL GAZETTEER]', error);
      return [];
    }
  }

  function dedupeGlobalLocations(ukResults, globalResults) {
    return globalResults.filter(globalResult => !ukResults.some(ukResult => {
      const sameLabel = String(globalResult.label).trim().toLowerCase() === String(ukResult.label).trim().toLowerCase();
      const close = Math.abs(globalResult.longitude - ukResult.longitude) < 0.03 && Math.abs(globalResult.latitude - ukResult.latitude) < 0.03;
      return sameLabel && close;
    }));
  }
'''
    source = replace_once(
        source,
        "\n  function selectLocation(result) {\n",
        global_lane + "\n  function selectLocation(result) {\n",
        "global gazetteer lane",
    )
    source = replace_once(
        source,
        "    const zoom = result.kind === 'postcode' ? 13 : result.kind === 'postcode_district' ? 11 : 12;\n",
        "    const zoom = result.kind === 'postcode' ? 13 : result.kind === 'postcode_district' ? 11 : result.kind === 'global_place' ? 12 : 12;\n"
        "    const provider = result.provider || 'postcodes.io';\n",
        "location provider and zoom",
    )
    source = replace_once(
        source,
        "<span style=\"color:#555;font-size:9px\">Location only · postcodes.io · no project identity claimed</span>",
        "<span style=\"color:#555;font-size:9px\">Location only · ${escapeHtml(provider)} · no project identity claimed</span>",
        "provider-aware popup",
    )

    render_and_execute = r'''  function renderResults(repdResults, resultsEl, ukResults = [], globalResults = []) {
    resultsEl.innerHTML = '';
    if (!repdResults.length && !ukResults.length && !globalResults.length) {
      const empty = document.createElement('div');
      empty.className = 'search-no-results';
      empty.textContent = 'No REPD project, postcode, address or place match';
      resultsEl.appendChild(empty);
      resultsEl.style.display = 'block';
      return;
    }

    for (const result of repdResults) {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.dataset.repdRef = result.repd_ref;
      const location = [result.address, result.postcode, result.county].filter(Boolean).join(' · ');
      const capacity = Number.isFinite(result.capacity_mw) ? `${result.capacity_mw.toLocaleString('en-GB')} MW` : '';
      item.innerHTML = `<b>${escapeHtml(result.name)}</b><br><span>${escapeHtml(location)}</span>${capacity ? `<br><span style="color:#ffae00">${escapeHtml(capacity)}</span>` : ''}<span style="color:#555"> · REPD ${escapeHtml(result.repd_ref)}</span>`;
      item.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        resultsEl.style.display = 'none';
        selectResult(result);
      });
      resultsEl.appendChild(item);
    }

    function renderLocationLane(title, locations) {
      if (!locations.length) return;
      const divider = document.createElement('div');
      divider.className = 'search-no-results';
      divider.textContent = title;
      resultsEl.appendChild(divider);
      for (const result of locations) {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.dataset.locationKind = result.kind;
        item.dataset.locationProvider = result.provider || '';
        item.innerHTML = `<b>${escapeHtml(result.label)}</b><br><span>${escapeHtml(result.sublabel)}</span><span style="color:#555"> · fly to only, not a REPD project</span>`;
        item.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          resultsEl.style.display = 'none';
          selectLocation(result);
        });
        resultsEl.appendChild(item);
      }
    }

    renderLocationLane('UK location', ukResults);
    renderLocationLane('Global location', globalResults);
    resultsEl.style.display = 'block';
  }

  async function executeSearch(input, resultsEl, includeGlobal = false) {
    const serial = ++activeQuerySerial;
    const query = input.value.trim();
    if (query.length < 2) {
      resultsEl.innerHTML = '';
      resultsEl.style.display = 'none';
      return;
    }
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<div class="search-no-results">Searching REPD projects, postcodes, addresses and places…</div>';
    try {
      const [results, ukLocations, rawGlobalLocations] = await Promise.all([
        queryOfficialRepd(query, serial),
        queryUkGazetteer(query),
        includeGlobal ? queryGlobalGazetteer(query) : Promise.resolve([])
      ]);
      if (serial !== activeQuerySerial) return;
      const globalLocations = dedupeGlobalLocations(ukLocations, rawGlobalLocations);
      renderResults(results, resultsEl, ukLocations, globalLocations);
    } catch (error) {
      if (serial !== activeQuerySerial) return;
      state.failures.push({ query, message: String(error?.message || error) });
      resultsEl.innerHTML = '<div class="search-no-results">Search unavailable — V8 map remains usable</div>';
      resultsEl.style.display = 'block';
      console.error('[V9.5 PLACE SEARCH]', error);
    }
  }

'''
    source = regex_replace_once(
        source,
        r"  function renderResults\([\s\S]*?\n  async function waitForCapturedMap",
        render_and_execute + "  async function waitForCapturedMap",
        "results and serialised execution",
    )
    source = replace_once(
        source,
        "    input.setAttribute('placeholder', 'Search project, UK postcode or town...');\n"
        "    input.setAttribute('aria-label', 'Search project, UK postcode or town');\n",
        "    input.setAttribute('placeholder', 'Search project, address, postcode or place...');\n"
        "    input.setAttribute('aria-label', 'Search project, address, postcode or place');\n",
        "search discoverability",
    )
    source = replace_once(
        source,
        "      debounceTimer = setTimeout(() => executeSearch(input, resultsEl), 180);\n",
        "      debounceTimer = setTimeout(() => executeSearch(input, resultsEl, false), 180);\n",
        "debounced local lanes",
    )
    # Enter is nested inside an if (8 spaces); button click is one level shallower (6 spaces).
    for indent, label in [("        ", "Enter submission"), ("      ", "button submission")]:
        source = replace_once(
            source,
            f"{indent}executeSearch(input, resultsEl);\n",
            f"{indent}executeSearch(input, resultsEl, true);\n",
            label,
        )

    for marker in [
        "const serial = ++activeQuerySerial",
        "if (serial !== activeQuerySerial) return",
        "GLOBAL_GEOCODER_URL",
        "Nominatim / OpenStreetMap",
        "kind: 'global_place'",
        "TRY_CAST(repd_ref AS BIGINT) ASC",
        "url.searchParams.delete('repd_ref')",
        "Location only · ${escapeHtml(provider)} · no project identity claimed",
    ]:
        if marker not in source:
            raise RuntimeError(f"compiled cartridge missing invariant: {marker}")
    return source


