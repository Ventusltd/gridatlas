export const ATLAS_V9_5_GLOBAL_GAZETTEER_FLYTO_CONTRACT = Object.freeze({
  schema: 'gridatlas.cartridge.v1',
  generation: '202609011141',
  version: 'v9.5',
  activation: 'explicit-user-query',
  providers: ['postcodes.io', 'Nominatim / OpenStreetMap'],
  repdResultsFirst: true,
  staleResponseGuard: true,
  resultClass: 'LOCATION_ONLY',
  proximityEstablishesIdentity: false,
  setsDeepLink: false,
  // Additive since 202609011141: a resolved deep link and a
  // selection publish the technology and capacity they resolved,
  // so the measurement cartridge needs no second resolver.
  publishesResolvedTechnologyAndCapacity: true
});
