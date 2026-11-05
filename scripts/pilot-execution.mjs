/** Engineering execution gates, separate from historical public-display approval. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const STAGE_A_CHECKS = [
  'dependency-chain-audit',
  'frozen-install',
  'lint',
  'typecheck',
  'format',
  'unit',
  'data-audit',
  'web-build',
  'browser-e2e',
  'local-database',
  'review-publication-safeguards',
  'historical-preservation',
  'fresh-android-build',
  'android-smoke',
  'draft-pr-and-report',
]
export const STAGE_B_CHECKS = [
  'server-pilot-geography',
  'mobile-pilot-integration',
  'public-research-separation',
  'approval-expiry-revocation',
  'bounded-cancelled-queries',
  'release-configuration',
  'pilot-flow-tests',
  'native-pilot-smoke',
]
export const fileSha256 = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex')

function requiredChecks(execution, requirements) {
  const checks = execution?.checks
  if (!Array.isArray(checks))
    throw new Error('Executed check records are required')
  const byId = new Map()
  for (const check of checks) {
    if (
      byId.has(check.id) ||
      !requirements.includes(check.id) ||
      !['PASS', 'FAIL', 'BLOCKED', 'IN_PROGRESS', 'NOT_STARTED'].includes(
        check.status,
      )
    )
      throw new Error('Unknown, duplicated or invalid execution check')
    if (
      check.status === 'PASS' &&
      (check.executed !== true ||
        check.satisfied !== true ||
        !Array.isArray(check.evidenceReferences) ||
        !check.evidenceReferences.length)
    )
      throw new Error('A passing check requires executed, satisfied evidence')
    if (
      check.status !== 'PASS' &&
      (typeof check.blocker !== 'string' || !check.blocker.trim())
    )
      throw new Error(
        'Incomplete checks require an explicit remaining action or blocker',
      )
    byId.set(check.id, check)
  }
  const missing = requirements.filter((id) => byId.get(id)?.status !== 'PASS')
  return {
    status: missing.length ? 'BLOCKED' : 'PASS',
    remainingChecks: missing,
  }
}

export function evaluatePilotExecution(plan, stageA, stageB = null) {
  if (
    plan?.schemaVersion !== 1 ||
    plan.phasePolicy?.['1E'] !== 'DEFERRED_TO_PILOT' ||
    plan.phasePolicy?.['1F'] !== 'IN_PROGRESS' ||
    plan.phasePolicy?.['1G'] !== 'DEFERRED_TO_PILOT' ||
    plan.scope?.basis !== 'founder_directive' ||
    plan.scope?.demandValidated !== false ||
    plan.scope?.willingnessToPayValidated !== false ||
    plan.scope?.operatorParticipationValidated !== false ||
    JSON.stringify(plan.scope?.cities) !==
      JSON.stringify(['Manila', 'Mandaluyong']) ||
    plan.pilotReleaseAuthorized !== false
  )
    throw new Error(
      'Execution policy cannot invent commercial validation or release authorization',
    )
  const first = requiredChecks(stageA, STAGE_A_CHECKS)
  if (stageB && first.status !== 'PASS')
    throw new Error(
      'Stage B cannot execute before every Stage A technical gate passes',
    )
  const second = stageB
    ? requiredChecks(stageB, STAGE_B_CHECKS)
    : {
        status: 'NOT_STARTED',
        remainingChecks: [...STAGE_B_CHECKS],
      }
  return {
    schemaVersion: 1,
    planId: plan.planId,
    phasePolicy: plan.phasePolicy,
    stageA: first,
    stageB: second,
    engineeringStatus:
      first.status === 'PASS' && second.status === 'PASS'
        ? '1F_ENGINEERING_READY'
        : 'IN_PROGRESS',
    pilotReleaseAuthorized: false,
    historicalPublicDisplayGateModified: false,
    historicalPublicDisplayGateStatus: plan.historicalGate.status,
    notice:
      'Engineering evidence grants no parking identity, visitor access, entrance, operator permission or public publication approval.',
  }
}

function main() {
  const [planPath, stageAPath, stageBPath] = process.argv.slice(2)
  if (!planPath || !stageAPath || process.argv.length > 5)
    throw new Error(
      'Usage: node scripts/pilot-execution.mjs PLAN STAGE_A [STAGE_B]',
    )
  const json = (path) => JSON.parse(readFileSync(path, 'utf8'))
  const plan = json(planPath)
  if (fileSha256(plan.historicalGate.path) !== plan.historicalGate.sha256)
    throw new Error(
      'Historical phase-gate evidence changed; do not overwrite its decisions',
    )
  const historical = json(plan.historicalGate.path)
  if (
    historical.overallStatus !== plan.historicalGate.status ||
    JSON.stringify(
      historical.phases.map(({ id, status }) => ({ id, status })),
    ) !== JSON.stringify(plan.historicalGate.phases)
  )
    throw new Error(
      'Execution plan misrepresents historical phase-gate decisions',
    )
  process.stdout.write(
    JSON.stringify(
      evaluatePilotExecution(
        plan,
        json(stageAPath),
        stageBPath ? json(stageBPath) : null,
      ),
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
