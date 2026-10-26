import { fetchVerifiedJson } from "./data-gridatlas-client.mjs";

export const REPD_ROUTING_CONTRACT = Object.freeze({
  schema: "pipelinenews.v8.fast-project-index.v1",
  generation: "202608270055",
  releaseId: "202608291410-repd-routing",
  projects: 7680,
  mapIdentities: 7652,
  noMapIdentities: 28,
  identityKey: "repd_ref"
});

const EXACT_FIELDS = Object.freeze([
  "repd_ref", "gg_project_id", "name", "technology", "status", "capacity_mw",
  "county", "region", "operator", "repd_record_updated", "geometry_status",
  "latitude", "longitude"
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function dictionaryValue(dictionaries, name, index) {
  const values = dictionaries[name];
  invariant(Array.isArray(values), `routing dictionary missing: ${name}`);
  invariant(Number.isInteger(index) && index >= 0 && index < values.length, `routing dictionary index invalid: ${name}`);
  return values[index];
}

function immutableRoutingUrl(manifest, relative) {
  const routing = manifest.repd_routing;
  invariant(routing?.release_id === REPD_ROUTING_CONTRACT.releaseId, "routing release identity mismatch");
  invariant(relative === routing.release_path || relative === routing.projects_path, "routing path is not allowlisted");
  const base = new URL(routing.base_url);
  invariant(base.protocol === "https:" && base.hostname === "ventusltd.github.io", "routing host mismatch");
  invariant(base.pathname === "/data-gridatlas/202608291410-repd-routing/", "routing timestamp path mismatch");
  const resolved = new URL(relative, base);
  invariant(resolved.href.startsWith(base.href), "routing path escaped immutable folder");
  return resolved.href;
}

export function decodeRoutingProjects(payload) {
  invariant(payload?.schema === REPD_ROUTING_CONTRACT.schema, "routing projects schema mismatch");
  invariant(payload.generation === REPD_ROUTING_CONTRACT.generation, "routing projects generation mismatch");
  invariant(JSON.stringify(payload.fields) === JSON.stringify(EXACT_FIELDS), "routing projects fields mismatch");
  invariant(payload.dictionaries && typeof payload.dictionaries === "object", "routing dictionaries missing");
  invariant(Array.isArray(payload.rows) && payload.rows.length === REPD_ROUTING_CONTRACT.projects, "routing row closure mismatch");

  const field = Object.fromEntries(payload.fields.map((name, index) => [name, index]));
  const records = [];
  const byRef = new Map();
  let mapIdentities = 0;
  let noMapIdentities = 0;

  for (const row of payload.rows) {
    invariant(Array.isArray(row) && row.length === EXACT_FIELDS.length, "routing row width mismatch");
    const repdRef = row[field.repd_ref];
    invariant(typeof repdRef === "string" && /^\d+$/.test(repdRef), "routing repd_ref is not an exact numeric string");
    invariant(!byRef.has(repdRef), `duplicate routing repd_ref: ${repdRef}`);
    const geometryStatus = dictionaryValue(payload.dictionaries, "geometry_status", row[field.geometry_status]);
    invariant(["valid", "missing", "invalid"].includes(geometryStatus), `unknown geometry status: ${geometryStatus}`);
    const rawLatitude = row[field.latitude];
    const rawLongitude = row[field.longitude];
    let latitude = null;
    let longitude = null;
    let selectable = false;

    if (geometryStatus === "valid") {
      invariant(rawLatitude !== null && rawLongitude !== null, `valid routing geometry is null: ${repdRef}`);
      latitude = Number(rawLatitude);
      longitude = Number(rawLongitude);
      invariant(Number.isFinite(latitude) && Number.isFinite(longitude), `valid routing geometry is non-finite: ${repdRef}`);
      invariant(latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180, `routing geometry outside WGS84: ${repdRef}`);
      invariant(!(latitude === 0 && longitude === 0), `false zero-origin routing point: ${repdRef}`);
      invariant(!(latitude === 49.766807 && longitude === -7.55716), `transformed false-origin routing point: ${repdRef}`);
      selectable = true;
      mapIdentities += 1;
    } else {
      invariant(rawLatitude === null && rawLongitude === null, `NO MAP routing geometry contains coordinates: ${repdRef}`);
      noMapIdentities += 1;
    }

    const record = Object.freeze({
      repd_ref: repdRef,
      gg_project_id: String(row[field.gg_project_id]),
      name: String(row[field.name]),
      technology: dictionaryValue(payload.dictionaries, "technology", row[field.technology]),
      repd_technology: dictionaryValue(payload.dictionaries, "technology", row[field.technology]),
      status: dictionaryValue(payload.dictionaries, "status", row[field.status]).toLowerCase(),
      capacity_mw: Number(row[field.capacity_mw]),
      county: dictionaryValue(payload.dictionaries, "county", row[field.county]) || null,
      region: dictionaryValue(payload.dictionaries, "region", row[field.region]) || null,
      repd_operator_or_applicant: dictionaryValue(payload.dictionaries, "operator", row[field.operator]) || null,
      source_record_updated: row[field.repd_record_updated] || null,
      geometry_status: geometryStatus,
      latitude,
      longitude,
      selectable,
      routing_source: "EXACT_DATA_GRIDATLAS_PROJECTS_JSON"
    });
    records.push(record);
    byRef.set(repdRef, record);
  }

  invariant(mapIdentities === REPD_ROUTING_CONTRACT.mapIdentities, `routing MAP closure mismatch: ${mapIdentities}`);
  invariant(noMapIdentities === REPD_ROUTING_CONTRACT.noMapIdentities, `routing NO MAP closure mismatch: ${noMapIdentities}`);
  return Object.freeze({ records: Object.freeze(records), byRef, mapIdentities, noMapIdentities });
}

export function resolveRoutingRecord(decoded, repdRef) {
  if (typeof repdRef !== "string" || !/^\d+$/.test(repdRef)) {
    return Object.freeze({ found: false, selectable: false, reason: "INVALID_EXACT_REPD_REF", record: null });
  }
  const record = decoded.byRef.get(repdRef) || null;
  if (!record) return Object.freeze({ found: false, selectable: false, reason: "REPD_REF_NOT_IN_ROUTING_ORACLE", record: null });
  if (!record.selectable) {
    return Object.freeze({ found: true, selectable: false, reason: `NO_MAP_${record.geometry_status.toUpperCase()}`, record });
  }
  return Object.freeze({ found: true, selectable: true, reason: "MAP_EXACT_REPD_REF", record });
}

let routingCache = null;

export async function loadRoutingDeepLinkFallback(manifest, repdRef) {
  invariant(typeof repdRef === "string" && /^\d+$/.test(repdRef), "deep-link fallback requires exact numeric repd_ref");
  const routing = manifest.repd_routing;
  const release = await fetchVerifiedJson(
    immutableRoutingUrl(manifest, routing.release_path),
    routing.release_sha256
  );
  invariant(release?.schema === "data-gridatlas.repd-routing-release.v1", "routing release schema mismatch");
  invariant(release.release_id === routing.release_id && release.immutable === true, "routing release contract mismatch");
  invariant(release.source_commit === routing.source_commit, "routing source commit mismatch");
  invariant(release.classification === "IMMUTABLE_REPD_ROUTING_RELEASE", "routing release is not immutable-live routing data");
  invariant(release.public_url === routing.base_url, "routing release URL mismatch");
  invariant(release.coverage?.projects === REPD_ROUTING_CONTRACT.projects, "routing release project closure mismatch");
  invariant(release.coverage?.map_identities === REPD_ROUTING_CONTRACT.mapIdentities, "routing release MAP closure mismatch");
  invariant(release.coverage?.no_map_identities === REPD_ROUTING_CONTRACT.noMapIdentities, "routing release NO MAP closure mismatch");
  invariant(release.files?.projects?.path === routing.projects_path, "routing projects receipt path mismatch");
  invariant(release.files?.projects?.bytes === routing.projects_bytes, "routing projects receipt bytes mismatch");
  invariant(release.files?.projects?.sha256 === routing.projects_sha256, "routing projects receipt hash mismatch");
  routingCache ||= fetchVerifiedJson(
    immutableRoutingUrl(manifest, routing.projects_path),
    routing.projects_sha256,
    routing.projects_bytes
  ).then(decodeRoutingProjects);
  return resolveRoutingRecord(await routingCache, repdRef);
}

export function clearRoutingCacheForTests() {
  routingCache = null;
}
