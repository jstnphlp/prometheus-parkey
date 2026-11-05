/**
 * Metro Manila research geography. Requires a real, licensed 17-LGU GeoJSON;
 * the coarse extent below is NOT an administrative boundary.
 */
export const NCR_LGUS = [
  'Caloocan', 'Las Piñas', 'Makati', 'Malabon', 'Mandaluyong', 'Manila',
  'Marikina', 'Muntinlupa', 'Navotas', 'Parañaque', 'Pasay', 'Pasig',
  'Pateros', 'Quezon City', 'San Juan', 'Taguig', 'Valenzuela',
]
export const RESEARCH_EXTENT = { west: 120.85, south: 14.30, east: 121.27, north: 14.86 }
const lgus = new Set(NCR_LGUS)
const normalize = (x) => String(x ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\b(city of|municipality of|city|municipality)\b/g, '')
  .replace(/[^a-z]+/g, ' ').trim()
const canonicalNames = new Map(NCR_LGUS.map((x) => [normalize(x), x]))
const finitePoint = (p) => Array.isArray(p) && p.length >= 2 &&
  Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
  p[0] >= -180 && p[0] <= 180 && p[1] >= -90 && p[1] <= 90
export const inResearchExtent = (p) => finitePoint(p) &&
  p[0] >= RESEARCH_EXTENT.west && p[0] <= RESEARCH_EXTENT.east &&
  p[1] >= RESEARCH_EXTENT.south && p[1] <= RESEARCH_EXTENT.north
function segments(ring) {
  return ring.slice(1).map((p, i) => [ring[i], p])
}
function equal(a, b) { return a[0] === b[0] && a[1] === b[1] }
function checkRing(ring) {
  if (!Array.isArray(ring) || ring.length < 4 ||
      !ring.every(finitePoint) || !equal(ring[0], ring.at(-1)))
    throw new Error('Invalid or unclosed boundary polygon ring.')
}
function polygons(geometry) {
  if (geometry?.type === 'Polygon') return [geometry.coordinates]
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates
  throw new Error('Expected Polygon or MultiPolygon administrative boundary.')
}
export function validateNcrBoundaries(collection) {
  if (collection?.type !== 'FeatureCollection' ||
      !Array.isArray(collection.features))
    throw new Error('Expected a GeoJSON FeatureCollection of 17 NCR LGUs.')
  const found = new Map()
  for (const feature of collection.features) {
    const p = feature?.properties || {}
    const raw = p.lgu || p.shapeName || p.ADM2_EN || p.name || p.NAME_2
    const lgu = canonicalNames.get(normalize(raw))
    if (!lgu || !lgus.has(lgu) || found.has(lgu))
      throw new Error('Unexpected, ambiguous or repeated LGU boundary: ' + raw)
    const parts = polygons(feature.geometry)
    if (!parts.length) throw new Error('Empty LGU boundary: ' + lgu)
    let anyInExtent = false
    for (const poly of parts) {
      if (!Array.isArray(poly) || !poly.length) throw new Error('Invalid boundary: ' + lgu)
      for (const ring of poly) {
        checkRing(ring)
        if (ring.some(inResearchExtent)) anyInExtent = true
      }
    }
    if (!anyInExtent) throw new Error('LGU appears outside the NCR study extent: ' + lgu)
    found.set(lgu, feature.geometry)
  }
  if (found.size !== NCR_LGUS.length)
    throw new Error('Expected 17 distinct NCR LGUs; missing: ' +
      NCR_LGUS.filter((x) => !found.has(x)).join(', '))
  return found
}
function onSegment(p, a, b) {
  const cross = (p[1] - a[1]) * (b[0] - a[0]) -
    (p[0] - a[0]) * (b[1] - a[1])
  if (Math.abs(cross) > 1e-10) return false
  return p[0] >= Math.min(a[0], b[0]) - 1e-10 &&
    p[0] <= Math.max(a[0], b[0]) + 1e-10 &&
    p[1] >= Math.min(a[1], b[1]) - 1e-10 &&
    p[1] <= Math.max(a[1], b[1]) + 1e-10
}
function inRing(p, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if (onSegment(p, a, b)) return true
    if ((a[1] > p[1]) !== (b[1] > p[1]) &&
        p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])
      inside = !inside
  }
  return inside
}
function inPolygon(p, poly) {
  return inRing(p, poly[0]) && !poly.slice(1).some((hole) => inRing(p, hole))
}
export function pointInNcrGeometry(p, geometry) {
  return finitePoint(p) && polygons(geometry).some((poly) => inPolygon(p, poly))
}
function orientation(a, b, c) {
  const z = (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
  return Math.abs(z) < 1e-12 ? 0 : Math.sign(z)
}
function crosses(a, b, c, d) {
  return onSegment(a,c,d) || onSegment(b,c,d) ||
    onSegment(c,a,b) || onSegment(d,a,b) ||
    (orientation(a,b,c) !== orientation(a,b,d) &&
     orientation(c,d,a) !== orientation(c,d,b))
}
function lineParts(geometry) {
  if (geometry?.type === 'LineString') return [geometry.coordinates]
  if (geometry?.type === 'MultiLineString') return geometry.coordinates
  return null
}
function featureIntersectsPolygon(geometry, bound) {
  const bp = polygons(bound)
  if (geometry?.type === 'Point') return pointInNcrGeometry(geometry.coordinates, bound)
  const fp = geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon'
    ? polygons(geometry) : null
  const lines = lineParts(geometry) ||
    (fp ? fp.flatMap((p) => p) : null)
  if (!lines) return false
  for (const line of lines) {
    if (!Array.isArray(line) || line.length < 2 || !line.every(finitePoint)) continue
    if (line.some((p) => pointInNcrGeometry(p, bound))) return true
    for (const part of bp) {
      if (fp && part[0].some((p) => pointInNcrGeometry(p, geometry))) return true
      for (const ring of part) {
        for (const [a,b] of segments(line)) {
          if (segments(ring).some(([c,d]) => crosses(a,b,c,d))) return true
        }
      }
    }
  }
  return false
}
/** A border-crossing street can have multiple LGU owners; don't double count. */
export function intersectingLgus(geometry, boundaries) {
  return NCR_LGUS.filter((lgu) => featureIntersectsPolygon(geometry, boundaries.get(lgu)))
}
/** A research cell is not a legal/admin polygon, and is never a parking entrance. */
export function researchCell(point, step = 0.01) {
  if (!finitePoint(point) || !(step > 0 && step <= 0.05))
    throw new Error('Invalid research grid point or step.')
  const west = Math.floor(point[0]/step + 1e-10)*step
  const south = Math.floor(point[1]/step + 1e-10)*step
  return west.toFixed(4) + ',' + south.toFixed(4)
}
