import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import {
  NCR_LGUS,
  RESEARCH_EXTENT,
  intersectingLgus,
  validateNcrBoundaries,
} from './ncr-geography.mjs'

export const HOTSPOT_WINDOWS = [
  [
    'poblacion',
    'Poblacion legacy research envelope',
    [121.024, 14.558, 121.041, 14.572],
  ],
  ['bgc', 'BGC', [121.04, 14.536, 121.06, 14.561]],
  ['binondo', 'Binondo', [120.967, 14.593, 120.985, 14.609]],
  ['makati-cbd', 'Makati CBD', [121.014, 14.548, 121.03, 14.566]],
  ['ortigas', 'Ortigas', [121.048, 14.574, 121.069, 14.596]],
  ['moa', 'MOA', [120.972, 14.524, 120.993, 14.544]],
  ['cubao', 'Cubao', [121.045, 14.613, 121.065, 14.634]],
  ['tomas-morato', 'Tomas Morato', [121.024, 14.628, 121.045, 14.648]],
  ['north-edsa', 'North EDSA', [121.016, 14.648, 121.04, 14.665]],
  ['alabang', 'Alabang', [121.025, 14.41, 121.055, 14.435]],
  ['maginhawa', 'Maginhawa', [121.049, 14.637, 121.069, 14.66]],
]
const countBy = (records, key) =>
  Object.fromEntries(
    [...new Set(records.map(key))]
      .sort()
      .map((value) => [value, records.filter((c) => key(c) === value).length]),
  )
const summarize = (records) => ({
  mappedEntities: records.length,
  byType: countBy(records, (c) => c.type),
  bySource: countBy(records, (c) => c.sourceKind),
  named: records.filter(
    (c) => !c.name.startsWith('Unnamed') && !c.name.startsWith('Mapped'),
  ).length,
  accessUnknown: records.filter((c) => c.accessClass === 'unknown').length,
  restricted: records.filter((c) => c.restrictedAccess).length,
  customerOnly: records.filter((c) => c.accessClass === 'customers').length,
  closedOrDisused: records.filter((c) =>
    c.flags.includes('mapped_closed_or_disused'),
  ).length,
  unknownLicense: records.filter(
    (c) => c.requiresLicenseReview || c.sourceLicense === 'unknown',
  ).length,
})

export function buildCoverage(research, boundaryGeojson) {
  if (
    !Array.isArray(research?.candidates) ||
    !Array.isArray(research?.facilityGroups)
  )
    throw new Error(
      'Expected normalized NCR research with facility identity groups.',
    )
  const boundaries = validateNcrBoundaries(boundaryGeojson)
  const perLgu = Object.fromEntries(
    NCR_LGUS.map((lgu) => {
      const records = research.candidates.filter((c) => c.lgus.includes(lgu))
      const groups = research.facilityGroups.filter((g) => g.lgus.includes(lgu))
      const warnings = []
      if (records.length < 25) warnings.push('sparse_mapping_review_required')
      if (!records.some((c) => c.sourceKind === 'overture'))
        warnings.push('no_overture_observations')
      if (!records.some((c) => c.type === 'street_segment'))
        warnings.push('no_street_mapping_not_proof_of_no_street_parking')
      if (!records.some((c) => c.type === 'space'))
        warnings.push('no_individual_bay_mapping')
      return [
        lgu,
        {
          ...summarize(records),
          deduplicatedFacilityCandidates: groups.length,
          warnings,
        },
      ]
    }),
  )
  const cells = []
  for (
    let x = Math.round(RESEARCH_EXTENT.west * 100);
    x < Math.round(RESEARCH_EXTENT.east * 100);
    x++
  ) {
    for (
      let y = Math.round(RESEARCH_EXTENT.south * 100);
      y < Math.round(RESEARCH_EXTENT.north * 100);
      y++
    ) {
      const west = x / 100,
        south = y / 100,
        east = (x + 1) / 100,
        north = (y + 1) / 100
      const geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
          ],
        ],
      }
      const lgus = intersectingLgus(geometry, boundaries)
      if (!lgus.length) continue
      const researchCell = `${west.toFixed(4)},${south.toFixed(4)}`
      const records = research.candidates.filter(
        (c) => c.researchCell === researchCell,
      )
      cells.push({
        researchCell,
        bbox: [west, south, east, north],
        lgus,
        ...summarize(records),
      })
    }
  }
  // A crossing source geometry can have its bbox center outside an LGU or even
  // outside the extraction extent. Keep that occupied cell and flag it rather
  // than silently losing an imported observation from the grid totals.
  const coveredCells = new Set(cells.map((c) => c.researchCell))
  for (const researchCell of new Set(
    research.candidates.map((c) => c.researchCell),
  )) {
    if (coveredCells.has(researchCell)) continue
    const [west, south] = researchCell.split(',').map(Number)
    const records = research.candidates.filter(
      (c) => c.researchCell === researchCell,
    )
    cells.push({
      researchCell,
      bbox: [west, south, west + 0.01, south + 0.01],
      lgus: [],
      representativeOutsideAdminGrid: true,
      ...summarize(records),
    })
  }
  cells.sort((a, b) => a.researchCell.localeCompare(b.researchCell))
  if (
    cells.reduce((sum, c) => sum + c.mappedEntities, 0) !==
    research.candidates.length
  )
    throw new Error('Grid observations do not reconcile with NCR research.')
  const hotspots = HOTSPOT_WINDOWS.map(([id, name, bbox]) => {
    const records = research.candidates.filter((c) => {
      const [x, y] = c.representativePoint
      return x >= bbox[0] && x < bbox[2] && y >= bbox[1] && y < bbox[3]
    })
    const ids = new Set(records.map((c) => c.id))
    return {
      id,
      name,
      bbox,
      ...summarize(records),
      deduplicatedFacilityCandidates: research.facilityGroups.filter((g) =>
        g.sourceCandidateIds.some((id) => ids.has(id)),
      ).length,
      status: 'more_evidence_needed',
      demand: null,
      willingnessToPay: null,
      opportunityRank: null,
    }
  })
  return {
    schemaVersion: 1,
    asOf: research.sourceAsOf,
    sourceHashes: research.sourceHashes,
    policy:
      'Mapped research observations only, not available spaces, complete inventory, measured demand or a launch ranking. City intersection totals can overlap; grid uses one representative point per source observation. Zero mapped cells may be unmapped, water or low-activity land. Hotspot rectangles are analyst-defined investigation windows, overlap, and are not administrative neighborhood boundaries.',
    counts: research.counts,
    summary: summarize(research.candidates),
    perLgu,
    grid: {
      stepDegrees: 0.01,
      cellCount: cells.length,
      zeroMappedCells: cells.filter((c) => c.mappedEntities === 0).length,
      cells,
    },
    hotspots,
    duplicateReviewPairs: research.duplicateReviewPairs,
  }
}

function main() {
  const args = process.argv.slice(2)
  if (args.length !== 3)
    throw new Error(
      'Usage: node scripts/ncr-coverage.mjs RESEARCH_JSON BOUNDARIES_GEOJSON OUTPUT_DIRECTORY',
    )
  const research = JSON.parse(readFileSync(args[0], 'utf8'))
  const coverage = buildCoverage(
    research,
    JSON.parse(readFileSync(args[1], 'utf8')),
  )
  const path = join(args[2], 'coverage.json')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(coverage, null, 2) + '\n', { flag: 'wx' })
  const header = [
    'lgu',
    'mapped_entities',
    'deduplicated_facility_candidates',
    'lots',
    'garages',
    'unspecified_facilities',
    'spaces',
    'street_segments',
    'entrances',
    'osm',
    'overture',
    'unknown_access',
    'restricted',
  ]
  const rows = Object.entries(coverage.perLgu).map(([lgu, r]) =>
    [
      lgu,
      r.mappedEntities,
      r.deduplicatedFacilityCandidates,
      ...[
        'lot',
        'garage',
        'facility_unspecified',
        'space',
        'street_segment',
        'entrance',
      ].map((k) => r.byType[k] || 0),
      r.bySource.osm || 0,
      r.bySource.overture || 0,
      r.accessUnknown,
      r.restricted,
    ].join(','),
  )
  writeFileSync(
    join(args[2], 'per-city.csv'),
    [header.join(','), ...rows].join('\n') + '\n',
    { flag: 'wx' },
  )
  process.stdout.write(
    JSON.stringify(
      {
        counts: coverage.counts,
        gridCells: coverage.grid.cellCount,
        zeroMappedCells: coverage.grid.zeroMappedCells,
        output: path,
      },
      null,
      2,
    ) + '\n',
  )
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main()
  } catch (error) {
    process.stderr.write(error.message + '\n')
    process.exitCode = 1
  }
}
