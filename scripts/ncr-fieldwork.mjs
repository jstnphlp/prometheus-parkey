import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { HOTSPOT_WINDOWS } from './ncr-coverage.mjs'
import { distanceMeters } from './parking-open-data.mjs'
import {
  FACILITY_TYPES,
  loadNcrResearch,
  validateReviewLedger,
} from './ncr-quality-review.mjs'

export const QUESTIONS = {
  identity:
    'Does this mapped object exist here, and what name/sign identifies it? Compare the source ID and neighboring possible matches; do not combine different floors or entrances by name alone.',
  access:
    'Can an ordinary visiting driver lawfully use it now? Record public/customer/resident/permit/employee conditions and the source of permission. Unknown remains unknown.',
  operation:
    'Is it operating at the observed date/time? Record closure, construction, obstruction or contradictory signs, without assuming a missing sign grants permission.',
  entrance:
    'Where is the permitted vehicle entrance and safe approach? Record a separately observed entrance coordinate and direction. The research anchor is not an entrance.',
  rates:
    'With permission, record the actual posted rate, currency, duration, grace/overnight/event rules and observed timestamp. If no rate is confirmed, leave it unknown.',
  hours:
    'What operating and entry/exit hours are actually posted or confirmed by an authorized operator? Record exceptions and the checked fact, not a general 24/7 assumption.',
  evidence:
    'Record dated sign/operator/observation evidence and limitations. Photograph only where permitted; avoid people, plates and private information.',
  parent:
    'Which physical facility owns this entrance or bay? Check signage, floor/bay identifier and visitor eligibility; a geometric parent proposal is not confirmation.',
  street:
    'Confirm the exact block, side, signs, loading/fire/driveway restrictions, schedules and applicable current ordinance. Do not park to test uncertain legality.',
  morato:
    'If within the Scout Rallos–Don A. Roces corridor, confirm the current IRR/implementation phase and Sunday 06:00–10:00 restrictions. SP-3345-S-2024 phases first-Sunday/every-other-Sunday/full implementation; do not assume every Sunday is closed.',
  category:
    'Is this a surface lot, parking structure, mall/commercial facility or another use? Record independent signs/operator evidence and exact scope. A name alone does not prove mall membership.',
  conflict:
    'Compare both conflicting source locations from the review ledger. Is this a relocation, different branch, entrance/floor, outdated provider position or an erroneous/nonparking listing? Do not choose or average a location without evidence.',
}
const priorityOrder = [
  'poblacion',
  'cubao',
  'bgc',
  'tomas-morato',
  'binondo',
  'makati-cbd',
  'ortigas',
  'moa',
  'north-edsa',
  'alabang',
  'maginhawa',
]
const periods = {
  poblacion:
    'Weeknight 18:00–21:00, contrasted with Friday/Saturday evening; proposed sampling, not confirmed business hours.',
  cubao:
    'Ordinary retail period and a documented Coliseum event or weekend/payday period; confirm the actual event calendar.',
  bgc: 'Weekday 08:00–10:00 office arrivals and an evening retail/dining period.',
  'tomas-morato':
    'Weeknight dining period plus a Sunday 06:00–10:00 corridor/signage observation, after checking the implemented ordinance phase.',
  binondo:
    'Weekday midday errands and a contrasting weekend period; distinguish loading from parking.',
  'makati-cbd':
    'Weekday office-arrival period and a contrasting evening or weekend retail period.',
  ortigas:
    'Weekday office-arrival period and a contrasting weekend mall period; check the responsible LGU.',
  moa: 'Ordinary retail period and a separately documented event period.',
  'north-edsa':
    'Weekday commuting/office period and a contrasting weekend retail period.',
  alabang: 'Weekday office period and a contrasting weekend retail period.',
  maginhawa:
    'Weeknight and weekend dining periods; account for resident access and current curb rules.',
  'other-ncr':
    'Two predeclared contrasting ordinary/peak periods based on locally confirmed land use; no peak demand inferred from source counts.',
}
const permissionInstructions = {
  restricted:
    'Do not enter; observe only from a lawful public place. Owner/operator authorization is required before entry, photography or any partner conversation.',
  ordinary:
    'Use only lawfully accessible approaches; obtain operator permission before entering restricted areas, photographing where restricted, or discussing inventory/partnerships.',
}
const readinessImpacts = {
  street:
    'Resolves block/side/access evidence only after human legal review; no automatic publication.',
  child:
    'Can establish parent identity and a permitted entrance/bay; does not create a separate facility or capacity claim.',
  facility:
    'Can resolve physical identity, visitor-access and operating facts for a facility; separate human license/publication approval remains required.',
}
function inWindow(c, bbox) {
  const [x, y] = c.representativePoint
  return x >= bbox[0] && x < bbox[2] && y >= bbox[1] && y < bbox[3]
}
const isNamed = (c) => !/^(Unnamed|Mapped)\b/.test(c.name)
const sourceQuestions = (c) => [
  'identity',
  'access',
  'operation',
  'entrance',
  'rates',
  'hours',
  'evidence',
  'category',
  ...(['space', 'entrance'].includes(c.type) ? ['parent'] : []),
  ...(c.type === 'street_segment' ? ['street'] : []),
]
export function navigationSearchLink(point) {
  if (
    !Array.isArray(point) ||
    point.length !== 2 ||
    !point.every(Number.isFinite) ||
    Math.abs(point[0]) > 180 ||
    Math.abs(point[1]) > 90
  )
    throw new Error(
      'Cannot construct navigation from invalid source coordinates',
    )
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point[1]},${point[0]}`)}`
}

function orderNearby(ids, byId) {
  if (!ids.length) return []
  const remaining = new Set([...ids].sort()),
    ordered = [remaining.values().next().value]
  remaining.delete(ordered[0])
  while (remaining.size) {
    const last = byId.get(ordered.at(-1)).representativePoint
    const next = [...remaining].sort(
      (a, b) =>
        distanceMeters(last, byId.get(a).representativePoint) -
          distanceMeters(last, byId.get(b).representativePoint) ||
        a.localeCompare(b),
    )[0]
    ordered.push(next)
    remaining.delete(next)
  }
  return ordered
}

export function buildFieldwork(research, ledger) {
  validateReviewLedger(ledger)
  assert.deepEqual(
    ledger.sourceHashes,
    research.sourceHashes,
    'Fieldwork and review ledger source versions must match',
  )
  const byId = new Map(research.candidates.map((c) => [c.id, c]))
  const candidateIssues = new Map()
  for (const issue of ledger.issues)
    for (const id of issue.candidateIds) {
      if (!candidateIssues.has(id)) candidateIssues.set(id, [])
      candidateIssues.get(id).push(issue)
    }
  const owners = research.candidates.filter(
    (c) =>
      c.priorHumanReview?.siteVisitRequired ||
      c.priorHumanReview?.reviewStatus === 'needs_site_visit',
  )
  const seeds = new Map(priorityOrder.map((id) => [id, []]))
  seeds.set(
    'poblacion',
    owners.map((c) => c.id),
  )
  if (byId.has('osm:way/184362727:MultiPolygon'))
    seeds.get('cubao').push('osm:way/184362727:MultiPolygon')
  if (byId.has('osm:node/1556858539:Point'))
    seeds.get('cubao').push('osm:node/1556858539:Point')
  const assigned = new Set([...seeds.values()].flat())
  for (const area of priorityOrder) {
    const [, , bbox] = HOTSPOT_WINDOWS.find(([id]) => id === area)
    const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
    const eligible = research.candidates
      .filter(
        (c) =>
          inWindow(c, bbox) &&
          FACILITY_TYPES.has(c.type) &&
          !assigned.has(c.id) &&
          !c.restrictedAccess &&
          c.priorHumanReview?.reviewStatus !== 'excluded_pending_reason',
      )
      .sort(
        (a, b) =>
          Number(isNamed(b)) - Number(isNamed(a)) ||
          distanceMeters(a.representativePoint, center) -
            distanceMeters(b.representativePoint, center) ||
          a.id.localeCompare(b.id),
      )
    for (const c of eligible) {
      if (seeds.get(area).length >= 6) break
      seeds.get(area).push(c.id)
      assigned.add(c.id)
    }
  }
  const routes = []
  for (const area of priorityOrder) {
    const pockets =
      area === 'poblacion'
        ? [
            [
              'owner-north',
              seeds
                .get(area)
                .filter((id) => byId.get(id).representativePoint[1] >= 14.565),
            ],
            [
              'owner-south',
              seeds
                .get(area)
                .filter((id) => byId.get(id).representativePoint[1] < 14.565),
            ],
          ]
        : [['sample', seeds.get(area)]]
    for (const [pocket, ids] of pockets) {
      if (!ids.length) continue
      const candidateIds = orderNearby(ids, byId)
      let distance = 0
      for (let i = 1; i < candidateIds.length; i++)
        distance += distanceMeters(
          byId.get(candidateIds[i - 1]).representativePoint,
          byId.get(candidateIds[i]).representativePoint,
        )
      routes.push({
        id: `${area}-${pocket}`,
        area,
        priority: priorityOrder.indexOf(area) + 1,
        priorityBasis:
          area === 'poblacion'
            ? 'Preserved owner visit requests; continuity, not commercial ranking.'
            : area === 'cubao'
              ? 'Official estate parking guide names investigation leads; no measured shortage.'
              : area === 'bgc'
                ? 'Estate FAQ/parking inquiry channel supports remote evidence access; no operator commitment.'
                : area === 'tomas-morato'
                  ? 'Time-dependent ordinance implementation needs legal and site evidence.'
                  : 'Contrasting investigation sample; no validated commercial ranking.',
        candidateIds,
        straightLineAnchorDistanceMeters: Math.round(distance),
        distanceCaveat:
          'Straight-line ordering only, not walking/driving directions or an assertion of a safe/passable route. Confirm public approaches and crossings.',
        suggestedPeriod: periods[area],
      })
    }
  }
  const routeOf = new Map(
    routes.flatMap((route) => route.candidateIds.map((id) => [id, route])),
  )
  const tasks = research.candidates
    .map((c) => {
      const route = routeOf.get(c.id)
      const window =
        route?.area ||
        HOTSPOT_WINDOWS.find(([, , bbox]) => inWindow(c, bbox))?.[0] ||
        'other-ncr'
      const issues = candidateIssues.get(c.id) || []
      const reasons = [...new Set(issues.flatMap((i) => i.reasons))].sort()
      const questions = sourceQuestions(c)
      if (window === 'tomas-morato') questions.push('morato')
      if (issues.some((i) => i.kind === 'provider_identity_location_conflict'))
        questions.push('conflict')
      const independentReferences = []
      if (c.id === 'osm:way/184362727:MultiPolygon')
        independentReferences.push({
          url: 'https://aranetacity.com/parking',
          fact: 'The official guide lists Parking Garage South; same-name source lead, precise facility/entrance identity still requires confirmation.',
          method: 'first_party_name_context_not_physical_verification',
        })
      if (window === 'bgc')
        independentReferences.push({
          url: 'https://bgc.com.ph/faqs/',
          fact: 'Estate FAQ names several parking areas. This is area-level context, not confirmation of this individual mapped feature or current visitor rights.',
          method: 'first_party_area_context',
        })
      if (window === 'tomas-morato')
        independentReferences.push({
          url: 'https://quezoncity.gov.ph/wp-content/uploads/2025/01/SP-3345-S-2024.pdf',
          fact: 'The ordinance describes phased Sunday restrictions on part of Tomas Morato. IRR date, current phase, geographic applicability and implementation need legal/site review.',
          method: 'official_ordinance_context_not_legal_approval',
        })
      return {
        id: c.id,
        name: c.name,
        lgus: c.lgus,
        hotspot: window,
        routeId: route?.id || null,
        firstWave: !!route && route.priority <= 4,
        researchStatus: c.researchStatus,
        verificationStatus: c.verification,
        publicationApproved: false,
        coordinates: c.representativePoint,
        sourceGeometryType: c.geometry.type,
        navigationSearchUrl: navigationSearchLink(c.representativePoint),
        ownerNavigationReference:
          c.priorHumanReview?.siteVisitReferenceUrl || null,
        remoteEstablished: {
          sourceKind: c.sourceKind,
          sourceRecordUrl: c.sourceRecordUrl,
          sourceLicense: c.sourceLicense,
          mappedType: c.type,
          mappedAccess: c.accessClass,
          sourceEditedAt: c.sourceRecordEditedAt,
          priorOwnerDecision: c.priorHumanReview || null,
          independentReferences,
        },
        unresolvedIssueIds: issues
          .filter((i) => i.status !== 'resolved_source_identity')
          .map((i) => i.id),
        uncertainties: reasons,
        questionKeys: questions,
        suggestedVisitPeriodKey: window,
        operatorPermissionNeededKey: c.restrictedAccess
          ? 'restricted'
          : 'ordinary',
        readinessImpactKey:
          c.type === 'street_segment'
            ? 'street'
            : ['space', 'entrance'].includes(c.type)
              ? 'child'
              : 'facility',
        status: 'pending_physical_observation',
      }
    })
    .sort(
      (a, b) =>
        (routeOf.get(a.id)?.priority || 100) -
          (routeOf.get(b.id)?.priority || 100) || a.id.localeCompare(b.id),
    )
  return {
    schemaVersion: 1,
    sourceHashes: research.sourceHashes,
    sourceAsOf: research.sourceAsOf,
    policy:
      'Private fieldwork preparation, not public parking listings or a commercial ranking. Every task remains unverified. No source coordinate is a confirmed entrance.',
    coordinateRole: 'source_research_anchor_not_confirmed_vehicle_entrance',
    sourceGeometryArchive: 'metro-parking-research.json.gz#candidates[id]',
    navigationPolicy:
      'Links are constructed solely from permitted source coordinates, for navigation/search only. No Google content acquired.',
    questions: QUESTIONS,
    visitPeriods: periods,
    permissionInstructions,
    readinessImpacts,
    routes,
    tasks,
    summary: {
      tasks: tasks.length,
      firstWaveTasks: tasks.filter((t) => t.firstWave).length,
      routes: routes.length,
      legacyOwnerVisitTasks: owners.length,
      ownerNavigationReferences: tasks.filter((t) => t.ownerNavigationReference)
        .length,
      physicallyVerified: 0,
      publicationApproved: 0,
    },
  }
}

export const csvCell = (value) =>
  '"' +
  String(value ?? '')
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""') +
  '"'
export function fieldworkCsv(checklist) {
  const headers = [
    'id',
    'name',
    'lgus',
    'hotspot',
    'route_id',
    'first_wave',
    'longitude',
    'latitude',
    'research_status',
    'verification_status',
    'source_url',
    'navigation_search_url',
    'suggested_period',
    'uncertainties',
    'on_site_questions',
    'permission_needed',
    'readiness_impact',
  ]
  const rows = checklist.tasks
    .filter((t) => t.routeId)
    .map((t) =>
      [
        t.id,
        t.name,
        t.lgus.join(';'),
        t.hotspot,
        t.routeId,
        t.firstWave,
        t.coordinates[0],
        t.coordinates[1],
        t.researchStatus,
        t.verificationStatus,
        t.remoteEstablished.sourceRecordUrl,
        t.navigationSearchUrl,
        checklist.visitPeriods[t.suggestedVisitPeriodKey],
        t.uncertainties.join(';'),
        t.questionKeys.map((k) => checklist.questions[k]).join(' | '),
        checklist.permissionInstructions[t.operatorPermissionNeededKey],
        checklist.readinessImpacts[t.readinessImpactKey],
      ]
        .map(csvCell)
        .join(','),
    )
  return [headers.map(csvCell).join(','), ...rows].join('\n') + '\n'
}

function main() {
  const directory = process.argv[2] || 'data/ncr-research'
  const research = loadNcrResearch(directory),
    ledger = JSON.parse(
      readFileSync(join(directory, 'review-ledger.json'), 'utf8'),
    )
  const result = buildFieldwork(research, ledger),
    path = join(directory, 'fieldwork-checklist.json')
  if (process.argv.includes('--check')) {
    if (!existsSync(path))
      throw new Error('Fieldwork checklist has not been generated')
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), result)
    assert.equal(
      readFileSync(join(directory, 'fieldwork-checklist.csv'), 'utf8'),
      fieldworkCsv(result),
    )
  } else {
    mkdirSync(directory, { recursive: true })
    writeFileSync(path, JSON.stringify(result, null, 2) + '\n')
    writeFileSync(
      join(directory, 'fieldwork-checklist.csv'),
      fieldworkCsv(result),
    )
  }
  process.stdout.write(JSON.stringify(result.summary) + '\n')
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
