/** Original fictional teaching networks; no railway geography, names or artwork. */
export function trainLearningFixture(kind = 'local') {
  const names = kind === 'express' ? ['Harbour', 'Highland', 'Far Reach']
    : kind === 'branch' ? ['Junction', 'West Branch', 'Junction', 'East Branch']
    : ['Central', 'Interchange', 'Gardens', 'Terminus'];
  const spacing = kind === 'express' ? 2 : 0.04;
  return {schema: 'gridatlas.train.fixture.v1', synthetic: true,
    title: kind === 'express' ? 'Fictional express learning journey'
      : kind === 'branch' ? 'Fictional branch and junction journey' : 'Fictional local and interchange journey',
    stops: names.map((name, i) => ({stationId: 'synthetic-' + name.toLowerCase().replaceAll(' ', '-'),
      id: 'synthetic-' + name.toLowerCase().replaceAll(' ', '-'), stopId: 'visit-' + i, name, kv: 400,
      at: [kind === 'branch' && i === 2 ? -1 : -1 + i * spacing, 52 + (i % 2) * spacing / 2],
      source: 'SYNTHETIC_TEACHING_FIXTURE'})),
    note: 'Original invented example. Lines require the same explicit simulated-journey action; no real electrical or railway connection is asserted.'};
}
