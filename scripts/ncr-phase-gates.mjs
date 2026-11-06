import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export function criterionStatus(criteria) {
  if (!Array.isArray(criteria) || !criteria.length)
    throw new Error('Required acceptance criteria cannot be empty.')
  for (const item of criteria) {
    if (
      !item.id ||
      !['PASS', 'FAIL', 'BLOCKED'].includes(item.status) ||
      !Array.isArray(item.evidenceReferences) ||
      !item.evidenceReferences.length
    )
      throw new Error(
        'Each criterion requires a disposition and evidence references.',
      )
    if (
      item.status === 'PASS' &&
      (item.executed !== true || item.satisfied !== true)
    )
      throw new Error('Unexecuted or unsatisfied criteria cannot pass.')
    if (item.status !== 'PASS' && !item.blocker)
      throw new Error('Unfinished criteria require an explicit blocker.')
  }
  return criteria.some((c) => c.status === 'FAIL')
    ? 'FAIL'
    : criteria.some((c) => c.status === 'BLOCKED')
      ? 'BLOCKED'
      : 'PASS'
}
export function validatePhaseReport(report) {
  if (
    report?.schemaVersion !== 1 ||
    !Array.isArray(report.phases) ||
    report.phases.length !== 7
  )
    throw new Error('Expected all seven Phase 1 gates.')
  const ids = new Set()
  for (const phase of report.phases) {
    if (
      !/^1[A-G]$/.test(phase.id) ||
      ids.has(phase.id) ||
      !Array.isArray(phase.requiredDeliverables) ||
      !phase.requiredDeliverables.length
    )
      throw new Error('Invalid or missing phase identity/deliverables.')
    ids.add(phase.id)
    if (
      !Array.isArray(phase.executedTests) ||
      !phase.executedTests.length ||
      phase.executedTests.some(
        (t) =>
          !t.checkId ||
          !['PASS', 'FAIL', 'BLOCKED'].includes(t.result) ||
          !t.evidenceReference,
      ) ||
      !Array.isArray(phase.evidenceReferences) ||
      !phase.evidenceReferences.length ||
      !Array.isArray(phase.outstandingBlockers)
    )
      throw new Error(
        'Each phase requires executed test results, evidence and outstanding blockers.',
      )
    if (phase.status !== criterionStatus(phase.acceptanceCriteria))
      throw new Error('Phase gate does not match its mandatory criteria.')
  }
  const status = report.phases.some((p) => p.status === 'FAIL')
    ? 'FAIL'
    : report.phases.some((p) => p.status === 'BLOCKED')
      ? 'BLOCKED'
      : 'PASS'
  if (report.overallStatus !== status)
    throw new Error('Overall gate cannot bypass a mandatory phase.')
  if (
    report.actual.physicallyVerified !== 0 ||
    report.actual.publicationApproved !== 0
  )
    throw new Error(
      'This source-only completion report cannot invent human verification or approvals.',
    )
  return true
}
function main() {
  const directory = process.argv[2] || 'data/ncr-research'
  const path = join(directory, 'phase1-gates.json'),
    report = JSON.parse(readFileSync(path, 'utf8'))
  validatePhaseReport(report)
  for (const phase of report.phases)
    for (const ref of phase.evidenceReferences)
      if (!existsSync(ref.split('#')[0]))
        throw new Error('Missing evidence reference: ' + ref)
  if (process.argv.includes('--write'))
    writeFileSync(path, JSON.stringify(report, null, 2) + '\n')
  process.stdout.write(
    JSON.stringify({
      overall: report.overallStatus,
      phases: report.phases.map((p) => ({ id: p.id, status: p.status })),
    }) + '\n',
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
