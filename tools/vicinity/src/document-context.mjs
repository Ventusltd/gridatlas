/** Existing documentary context only. No fetch, name matching or spatial joins. */
function freezeDocumentContext(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freezeDocumentContext(child); Object.freeze(value); }
  return value;
}

export const DOCUMENT_CONTEXT_PROVENANCE = freezeDocumentContext({
  declaredModule: {
    repository: 'Ventusltd/gridatlas', commit: 'b52693aaf513e63240acd8ab99a698df5b738cc6',
    path: 'atlas/modules/202609012128-declared-connections.js', bytes: 15461,
    sha256: 'a44520ebd644e725f644e7f3aea76839982c82d577022ac04583c5bc3346a371',
    sourceUrl: 'https://github.com/Ventusltd/gridatlas/blob/b52693aaf513e63240acd8ab99a698df5b738cc6/atlas/modules/202609012128-declared-connections.js'
  },
  noticeProducer: {
    repository: 'Ventusltd/globalgrid2050', commit: '07bff3a6d1cdc4d845062cafa1cf49161b135c96',
    path: 'automation/grid_notice_ui/20261117-v938/notice.json', bytes: 5300,
    sha256: 'bef90e1a64e4f1921c62f85ee61d636d1fe02fcebd30ea1570a7b3bfd49f5148',
    factsSha256: 'f9802c96444c21e84b328d612475353861c8053cde31f55196d1ea5862918afb',
    sourceUrl: 'https://github.com/Ventusltd/globalgrid2050/blob/07bff3a6d1cdc4d845062cafa1cf49161b135c96/automation/grid_notice_ui/20261117-v938/notice.json',
    reviewReferences: ['https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-6953350836', 'https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-6953404444']
  }
});

export const DOCUMENT_CONTEXT_NOTICES = freezeDocumentContext([{
  id: 'government:EN020026:consented:2026-10-30', title: 'Sea Link development consent',
  applicationRef: 'EN020026', status: 'NARROW_FACTS_REVIEWED_NO_ASSET_ASSOCIATION',
  sourceUrl: 'https://www.gov.uk/government/publications/sea-link-development-consent-order-planning-act-2008',
  sourceTitle: 'Department for Energy Security and Net Zero: Sea Link development consent order',
  date: {value: '2026-10-30', precision: 'DAY'},
  statement: 'Government decision records development consent for the Suffolk–Kent transmission proposal. Its planned transmission upper bound is 2,000 MW; current capacity, commissioning and available headroom are unknown.',
  scope: 'Standalone official planning context. No association with the selected asset or its vicinity has been established.',
  plannedMetric: {value: 2000, unit: 'MW', kind: 'planned_transmission_upper_bound'},
  currentCapacityMw: null, commissioned: null, connection: null, repdRef: null, coordinates: null,
  verifiedAssetJoins: 0,
  rightsScope: 'government_html_facts_only_no_images_or_third_party_material',
  licenceUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
  sources: [
    {title: 'Planning Inspectorate: Sea Link development consent decision announced', url: 'https://www.gov.uk/government/news/sea-link-development-consent-decision-announced',
      publishedDate: {value: '2026-10-30', precision: 'DAY'}, sourceUpdatedAt: null,
      archivedReceipt: {retrievedAt: '2026-11-17T15:48:11Z', bytes: 68432, sha256: 'b9ba26b90820292e0b181da7993d2d3a2180fc2de0ac53cc6239adeb4cccfaeb'},
      currentObservation: {retrievedAt: '2026-11-18T00:35:01.291330Z', bytes: 68432, sha256: 'b404ca2c91a4b84def5c521ceccab617c4b3bda860d40d2da32fd3e9298f599a', scope: 'Decision day and stated OGL footer reconfirmed; current HTML differs from archived receipt.'}},
    {title: 'Department for Energy Security and Net Zero: Sea Link development consent order', url: 'https://www.gov.uk/government/publications/sea-link-development-consent-order-planning-act-2008',
      publishedDate: {value: '2026-10-30', precision: 'DAY'}, sourceUpdatedAt: null,
      archivedReceipt: {retrievedAt: '2026-11-17T15:48:11Z', bytes: 69536, sha256: 'c26f93aa307740f8b4ec8ad150b152fb6d30e77f201e5bc31a6da52bba16e0d0'},
      currentObservation: {retrievedAt: '2026-11-18T00:35:01.437596Z', bytes: 69536, sha256: 'f15b12f35fa4fd1364894d550d3f053dfa680550ad7d83a56fa5b794624e4084', scope: 'Decision day and stated OGL footer reconfirmed; current HTML differs from archived receipt.'}}
  ]
}]);

function documentOrigin(origin) {
  if (!origin || !['repd', 'datacentre', 'substation'].includes(origin.type) || typeof origin.id !== 'string'
      || !origin.id || origin.id.length > 256 || /[\s\u0000-\u001f\u007f]/.test(origin.id)) return null;
  return {type: origin.type, id: origin.id};
}

export function documentContextFor(origin, {declaredConnections} = {}) {
  const identity = documentOrigin(origin), matchedRecords = [];
  const limitations = [
    'No independently verified asset-to-upgrade or asset-to-notice crosswalk is supplied by this adapter.',
    'A published declaration or planning consent does not establish construction, energisation, a surveyed route, electrical connection, power flow or available capacity.',
    'The standalone Sea Link notice is not linked to the selected asset, nearby substations or a distance radius.'
  ];
  // Read the canonical already-published owner table; do not fork its records or
  // attach works to a nearby/name-matching substation. Its status stays verbatim.
  const ref = identity?.type === 'repd' && /^repd:[1-9]\d*$/.test(identity.id) ? identity.id.slice(5) : null;
  const canonical = declaredConnections?.schema === 'gridatlas.module.declared-connections.v1' ? declaredConnections.records : null;
  const declaration = ref && canonical && Object.hasOwn(canonical, ref) ? canonical[ref] : null;
  if (declaration && typeof declaration.source === 'string') {
    const statement = [declaration.works, declaration.poc_works, declaration.via].filter(v => typeof v === 'string' && v).join('; ');
    if (statement) matchedRecords.push({
      id: 'existing-atlas-declaration:' + ref, originId: identity.id,
      title: 'Existing published declaration for REPD ' + ref,
      sourceUrl: DOCUMENT_CONTEXT_PROVENANCE.declaredModule.sourceUrl, sourceTitle: declaration.source,
      statement, status: 'EXISTING_PUBLISHED_DECLARATION_UNREVALIDATED',
      scope: 'Existing published declaration; source citation not revalidated here. Exact REPD key only; not an independently verified asset-to-document association.',
      matchBasis: 'EXACT_REPD_KEY_IN_CANONICAL_OWNER_MODULE', verifiedAssetAssociation: false,
      date: null, datePrecision: 'UNKNOWN',
      declaredStatus: declaration.poc_status ?? null,
      // Preserve the original owner's fields and classification separately from
      // this adapter's review status. Never infer an absent status or date.
      declaration: Object.fromEntries(['works', 'poc_works', 'substation', 'circuit', 'via', 'source', 'poc_status', 'poc_status_note', 'poc_kind', 'kv']
        .filter(k => Object.hasOwn(declaration, k)).map(k => [k, declaration[k]]))
    });
  }
  if (!identity) limitations.unshift('No supported stable source identity was supplied; names and coordinates were not used to create a match.');
  else if (!matchedRecords.length) limitations.unshift('No exact existing documentary declaration is available for this source identity.');
  return freezeDocumentContext({
    schema: 'gridatlas.vicinity.document-context.v1', origin: identity,
    status: matchedRecords.length ? 'EXISTING_DECLARATION_ONLY' : 'NO_EXACT_ASSET_DOCUMENT_CONTEXT',
    matchedRecords, unassociatedNotices: DOCUMENT_CONTEXT_NOTICES,
    verifiedAssetJoins: 0, realConnectionsInferred: 0,
    counts: {existingDeclarations: matchedRecords.length, unassociatedNotices: 1, governmentDocuments: 2, verifiedAssetJoins: 0},
    limitations, provenance: DOCUMENT_CONTEXT_PROVENANCE
  });
}
