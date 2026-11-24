import { createRouteFollower } from './route-follower.mjs';

export const point = (role, coordinates) => ({
  type: 'Feature',
  properties: { role },
  geometry: { type: 'Point', coordinates },
});

export function createPositionOverlay(coordinates, maths) {
  const line = { type: 'LineString', coordinates: coordinates.map(at => at.slice()) };
  const locate = createRouteFollower(line, maths);
  return (fix, nowMs) => {
    const metrics = locate(fix, nowMs);
    const features = [
      { type: 'Feature', properties: { role: 'selected-section' }, geometry: line },
    ];
    if (metrics.status === 'ok' || metrics.status === 'uncertain') {
      const measured = [fix.longitude, fix.latitude];
      features.push(point('measured-gps', measured));
      if (fix.accuracyM > 0) {
        const ring = maths.geodesicCircle(...measured, fix.accuracyM / 1000, 64);
        features.push({
          type: 'Feature',
          properties: { role: 'gps-accuracy' },
          geometry: { type: 'Polygon', coordinates: [ring] },
        });
      }
      if (metrics.status === 'ok') features.push(point('nearest-on-section', metrics.nearest));
    }
    return { metrics, features };
  };
}
