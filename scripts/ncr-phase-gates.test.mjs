import assert from 'node:assert/strict'
import test from 'node:test'

import { criterionStatus, validatePhaseReport } from './ncr-phase-gates.mjs'
const passed = {
  id: 'test',
  status: 'PASS',
  executed: true,
  satisfied: true,
  evidenceReferences: ['test:executed-fixture'],
}
test('a phase cannot pass on an unexecuted test, written plan, or missing evidence', () => {
  assert.equal(criterionStatus([passed]), 'PASS')
  assert.equal(
    criterionStatus([
      passed,
      {
        ...passed,
        id: 'field',
        status: 'BLOCKED',
        executed: false,
        satisfied: false,
        blocker: 'Actual site observations needed',
      },
    ]),
    'BLOCKED',
  )
  assert.throws(
    () => criterionStatus([{ ...passed, executed: false }]),
    /Unexecuted/,
  )
  assert.throws(
    () => criterionStatus([{ ...passed, satisfied: false }]),
    /unsatisfied/,
  )
  assert.throws(
    () => criterionStatus([{ ...passed, evidenceReferences: [] }]),
    /evidence/,
  )
  assert.throws(() => criterionStatus([]), /empty/)
})
test('overall completion cannot conceal an incomplete phase or fabricated field result', () => {
  const report = {
    schemaVersion: 1,
    overallStatus: 'PASS',
    actual: { physicallyVerified: 0, publicationApproved: 0 },
    phases: [...'ABCDEFG'].map((letter) => ({
      id: '1' + letter,
      status: 'PASS',
      requiredDeliverables: ['test fixture'],
      acceptanceCriteria: [passed],
      executedTests: [
        {
          checkId: 'fixture',
          result: 'PASS',
          evidenceReference: 'test:executed-fixture',
        },
      ],
      evidenceReferences: ['test:executed-fixture'],
      outstandingBlockers: [],
    })),
  }
  assert.equal(validatePhaseReport(report), true)
  const missingResults = globalThis.structuredClone(report)
  missingResults.phases[0].executedTests = []
  assert.throws(
    () => validatePhaseReport(missingResults),
    /executed test results/,
  )
  const pending = globalThis.structuredClone(report)
  pending.phases[6].status = 'BLOCKED'
  pending.phases[6].acceptanceCriteria = [
    {
      ...passed,
      status: 'BLOCKED',
      satisfied: false,
      executed: false,
      blocker: 'Field observations missing',
    },
  ]
  assert.throws(() => validatePhaseReport(pending), /Overall gate/)
  assert.throws(
    () =>
      validatePhaseReport({
        ...report,
        actual: { physicallyVerified: 1, publicationApproved: 0 },
      }),
    /invent/,
  )
})
