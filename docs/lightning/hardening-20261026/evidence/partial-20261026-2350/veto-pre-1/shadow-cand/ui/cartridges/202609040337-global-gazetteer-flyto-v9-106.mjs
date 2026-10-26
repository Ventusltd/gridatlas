export const ATLAS_V9_106_GLOBAL_GAZETTEER_FLYTO_CONTRACT = Object.freeze({
  schema: 'gridatlas.cartridge.v1',
  generation: '202609040337',
  sourceGeneration: '202609040229',
  version: 'v9.106',
  activation: 'explicit-user-query-or-exact-repd-arrival',
  providers: ['postcodes.io', 'Nominatim / OpenStreetMap'],
  repdResultsFirst: true,
  staleResponseGuard: true,
  resultClass: 'LOCATION_ONLY',
  proximityEstablishesIdentity: false,
  setsDeepLink: false,
  publishesResolvedTechnologyAndCapacity: true,
  expectedActiveRegisterAbsenceIsNotFailure: true,
  suppliedArrivalFieldsRemainLinkProvenance: true,
  identityFailureRetryRequiresSharedArrivalEpoch: true
});
