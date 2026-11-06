import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluatePilotExecution,
  STAGE_A_CHECKS,
  STAGE_B_CHECKS,
} from './pilot-execution.mjs'

const plan = () => ({
  schemaVersion: 1,
  planId: 'fixture-engineering-plan',
  phasePolicy: {
    '1E': 'DEFERRED_TO_PILOT',
    '1F': 'IN_PROGRESS',
    '1G': 'DEFERRED_TO_PILOT',
  },
  scope: {
    basis: 'founder_directive',
    cities: ['Manila', 'Mandaluyong'],
    demandValidated: false,
    willingnessToPayValidated: false,
    operatorParticipationValidated: false,
  },
  pilotReleaseAuthorized: false,
  historicalGate: { status: 'BLOCKED' },
})
const pass = (ids) => ({
  checks: ids.map((id) => ({
    id,
    status: 'PASS',
    executed: true,
    satisfied: true,
    evidenceReferences: ['fixture-result'],
  })),
})

test('deferred commercial and physical phases permit engineering but never publication', () => {
  const result = evaluatePilotExecution(
    plan(),
    pass(STAGE_A_CHECKS),
    pass(STAGE_B_CHECKS),
  )
  assert.equal(result.engineeringStatus, '1F_ENGINEERING_READY')
  assert.equal(result.pilotReleaseAuthorized, false)
  assert.equal(result.releaseStatuses['1F_ENGINEERING_READY'], true)
  assert.equal(result.releaseStatuses.PILOT_RELEASE_AUTHORIZED, false)
  assert.equal(result.historicalPublicDisplayGateStatus, 'BLOCKED')
  assert.equal(result.historicalPublicDisplayGateModified, false)
})

test('missing or blocked native validation prevents Stage B even if all other checks pass', () => {
  const first = pass(STAGE_A_CHECKS.filter((id) => id !== 'android-smoke'))
  assert.equal(evaluatePilotExecution(plan(), first).stageA.status, 'BLOCKED')
  assert.throws(
    () => evaluatePilotExecution(plan(), first, pass(STAGE_B_CHECKS)),
    /Stage B/,
  )
  first.checks.push({
    id: 'android-smoke',
    status: 'BLOCKED',
    blocker: 'No authorized device',
    evidenceReferences: ['fixture-device-list'],
  })
  assert.throws(
    () => evaluatePilotExecution(plan(), first, pass(STAGE_B_CHECKS)),
    /Stage B/,
  )
})

test('execution records cannot pass from plans alone, repeated check identities or fabricated commercial approval', () => {
  const unexecuted = pass(STAGE_A_CHECKS)
  unexecuted.checks[0].executed = false
  assert.throws(() => evaluatePilotExecution(plan(), unexecuted), /executed/)
  const emptyReference = pass(STAGE_A_CHECKS)
  emptyReference.checks[0].evidenceReferences = [null]
  assert.throws(
    () => evaluatePilotExecution(plan(), emptyReference),
    /evidence/,
  )
  const duplicate = pass(STAGE_A_CHECKS)
  duplicate.checks.push(duplicate.checks[0])
  assert.throws(() => evaluatePilotExecution(plan(), duplicate), /duplicated/)
  assert.throws(
    () =>
      evaluatePilotExecution(
        { ...plan(), pilotReleaseAuthorized: true },
        pass(STAGE_A_CHECKS),
      ),
    /release authorization/,
  )
  const inventedDemand = plan()
  inventedDemand.scope.demandValidated = true
  assert.throws(
    () => evaluatePilotExecution(inventedDemand, pass(STAGE_A_CHECKS)),
    /commercial validation/,
  )
})
