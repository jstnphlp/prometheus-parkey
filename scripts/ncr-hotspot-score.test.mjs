import assert from 'node:assert/strict'
import test from 'node:test'
import { scoreHotspotEvidence, WEIGHTS } from './ncr-hotspot-score.mjs'

const research = { schemaVersion: 1, scope: 'Metro Manila (NCR), all 17 LGUs' }
const metric = (metric, score = 3, confidence = 0.85) => ({
  metric,
  score,
  confidence,
  sourceKind: 'field_survey',
  observedOn: '2026-11-03',
  evidenceReference: 'internal:survey-0001',
})
const area = (id, metrics) => ({
  id,
  name: 'Research area ' + id,
  lgu: 'Makati',
  metrics,
})
const all = Object.keys(WEIGHTS).map((x) => metric(x))
test('only fully evidenced scores become rankable', () => {
  const score = scoreHotspotEvidence(
    {
      schemaVersion: 1,
      areas: [
        area('full', all),
        area('partial', all.slice(0, 2)),
        area(
          'weak',
          all.map((x) =>
            x.metric === 'demand' ? { ...x, confidence: 0.1 } : x,
          ),
        ),
      ],
    },
    research,
  )
  assert.equal(score.ranked.length, 1)
  assert.equal(score.ranked[0].researchScore, 60)
  assert.equal(score.incomplete.length, 2)
  assert.equal(
    score.incomplete.find((x) => x.id === 'partial').missingMetrics.length,
    3,
  )
  assert.deepEqual(
    score.incomplete.find((x) => x.id === 'weak').lowConfidenceMetrics,
    ['demand'],
  )
})
test('rejects made-up evidence, duplicates and out-of-scope places', () => {
  assert.throws(
    () =>
      scoreHotspotEvidence(
        {
          schemaVersion: 1,
          areas: [
            area('a', [{ ...metric('demand'), evidenceReference: null }]),
          ],
        },
        research,
      ),
    /Invalid or unsupported/,
  )
  assert.throws(
    () =>
      scoreHotspotEvidence(
        { schemaVersion: 1, areas: [area('x', all), area('x', all)] },
        research,
      ),
    /Invalid hotspot/,
  )
  assert.throws(
    () =>
      scoreHotspotEvidence(
        { schemaVersion: 1, areas: [{ ...area('x', all), lgu: 'Cebu City' }] },
        research,
      ),
    /Invalid hotspot/,
  )
  assert.throws(
    () => scoreHotspotEvidence({ schemaVersion: 1, areas: [] }, {}),
    /Expected NCR/,
  )
  assert.throws(
    () =>
      scoreHotspotEvidence(
        { schemaVersion: 1, areas: [area('x', [...all, metric('demand')])] },
        research,
      ),
    /Invalid or unsupported/,
  )
})
test('no evidence gives no winner, not a fabricated zero-demand claim', () => {
  const s = scoreHotspotEvidence(
    { schemaVersion: 1, areas: [area('research', [])] },
    research,
  )
  assert.equal(s.ranked.length, 0)
  assert.equal(s.incomplete[0].researchScore, null)
})
