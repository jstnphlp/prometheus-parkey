/**
 * Phase 1E research opportunity ranking.
 * This script scores human-supplied, dated, licensed/first-party evidence.
 * It never infers demand or usable parking capacity from OSM pin counts.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { NCR_LGUS } from './ncr-geography.mjs'

export const WEIGHTS = {
  demand: 0.3,
  usableSupplyGap: 0.25,
  willingnessToPay: 0.2,
  partnerPotential: 0.15,
  launchFeasibility: 0.1,
}
const sourceKinds = new Set([
  'field_survey',
  'first_party',
  'licensed_public',
  'interview',
])
const observedDate = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d\d-\d\d$/.test(v) &&
  !Number.isNaN(Date.parse(v + 'T00:00:00Z')) &&
  new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v &&
  v <= new Date().toISOString().slice(0, 10)
const isReference = (v) => typeof v === 'string' && v.trim().length >= 8

export function scoreHotspotEvidence(evidence, supply) {
  if (evidence?.schemaVersion !== 1 || !Array.isArray(evidence.areas))
    throw new Error('Expected Phase 1E evidence file with areas.')
  if (
    supply?.schemaVersion !== 1 ||
    supply.scope !== 'Metro Manila (NCR), all 17 LGUs'
  )
    throw new Error('Expected NCR supply research report.')
  const seen = new Set(),
    areas = []
  for (const area of evidence.areas) {
    if (
      !area ||
      typeof area.id !== 'string' ||
      !/^[a-z0-9-]+$/.test(area.id) ||
      seen.has(area.id) ||
      typeof area.name !== 'string' ||
      !area.name.trim() ||
      !NCR_LGUS.includes(area.lgu) ||
      !Array.isArray(area.metrics)
    )
      throw new Error('Invalid hotspot area identity or scope.')
    seen.add(area.id)
    const metrics = new Map()
    for (const item of area.metrics) {
      if (
        !Object.hasOwn(WEIGHTS, item.metric) ||
        metrics.has(item.metric) ||
        !Number.isFinite(item.score) ||
        item.score < 0 ||
        item.score > 5 ||
        !Number.isFinite(item.confidence) ||
        item.confidence < 0 ||
        item.confidence > 1 ||
        !observedDate(item.observedOn) ||
        !sourceKinds.has(item.sourceKind) ||
        !isReference(item.evidenceReference)
      )
        throw new Error('Invalid or unsupported evidence for ' + area.id)
      metrics.set(item.metric, item)
    }
    const missing = Object.keys(WEIGHTS).filter((k) => !metrics.has(k))
    const lowConfidence = [...metrics.values()]
      .filter((x) => x.confidence < 0.6)
      .map((x) => x.metric)
    const complete = missing.length === 0 && lowConfidence.length === 0
    const weighted = complete
      ? Object.entries(WEIGHTS).reduce(
          (acc, [key, weight]) =>
            acc + (metrics.get(key).score / 5) * weight * 100,
          0,
        )
      : null
    areas.push({
      id: area.id,
      name: area.name,
      lgu: area.lgu,
      rankable: complete,
      researchScore:
        weighted === null ? null : Math.round(weighted * 100) / 100,
      missingMetrics: missing,
      lowConfidenceMetrics: lowConfidence,
      evidenceCount: metrics.size,
      // Never claim measured demand or parking vacancy from research map pins.
      status: complete
        ? 'evidence_ready_for_human_review'
        : 'more_evidence_needed',
    })
  }
  const rankable = areas
    .filter((x) => x.rankable)
    .sort(
      (a, b) => b.researchScore - a.researchScore || a.id.localeCompare(b.id),
    )
  return {
    schemaVersion: 1,
    asOf: evidence.asOf ?? null,
    weights: WEIGHTS,
    policy:
      'Research-only human-supplied scores. Mapped supply does not measure parking demand, legal access, current vacancies, or available spaces. Scores do not constitute proof of market fit. Human review and site visits required.',
    areaCount: areas.length,
    ranked: rankable,
    incomplete: areas
      .filter((x) => !x.rankable)
      .sort((a, b) => a.id.localeCompare(b.id)),
  }
}
function main() {
  const args = process.argv.slice(2),
    get = (key) => {
      const i = args.indexOf(key)
      return i < 0 ? null : args[i + 1]
    }
  if (
    args.length !== 6 ||
    !get('--evidence') ||
    !get('--research') ||
    !get('--out') ||
    args.some(
      (x, i) =>
        i % 2 === 0 && !['--evidence', '--research', '--out'].includes(x),
    )
  )
    throw new Error(
      'Usage: node scripts/ncr-hotspot-score.mjs --evidence FILE --research NCR_RESEARCH_JSON --out FILE',
    )
  const score = scoreHotspotEvidence(
    JSON.parse(readFileSync(get('--evidence'), 'utf8')),
    JSON.parse(readFileSync(get('--research'), 'utf8')),
  )
  const out = get('--out')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(score, null, 2) + '\n', { flag: 'wx' })
  process.stdout.write(
    JSON.stringify(
      { ranked: score.ranked, incomplete: score.incomplete },
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
