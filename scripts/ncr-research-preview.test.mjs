import assert from 'node:assert/strict'
import test from 'node:test'
import { buildResearchHeatmap } from './ncr-research-preview.mjs'

const coverage = () => ({
  schemaVersion: 1,
  scope: 'Metro Manila research',
  counts: {
    insideNcr: 4,
    physicallyVerified: 0,
    publicationApproved: 0,
  },
  grid: {
    cells: [
      {
        researchCell: '121.0300,14.5600',
        bbox: [121.03, 14.56, 121.04, 14.57],
        mappedEntities: 3,
        byType: { lot: 1, entrance: 1, street_segment: 1 },
        restricted: 1,
        accessUnknown: 2,
      },
      {
        researchCell: '121.0400,14.5600',
        bbox: [121.04, 14.56, 121.05, 14.57],
        mappedEntities: 1,
        byType: { facility_unspecified: 1 },
        restricted: 0,
        accessUnknown: 1,
      },
    ],
  },
})

test('local preview is aggregate-only and never promises usable parking', () => {
  const html = buildResearchHeatmap(coverage())
  assert.match(html, /INTERNAL RESEARCH ONLY/)
  assert.match(html, /NOT available spaces/)
  assert.match(html, /Mapped restricted-access features/)
  assert.match(html, /© OpenStreetMap contributors/)
  assert.match(html, /aria-live="polite"/)
  assert.equal((html.match(/<rect /g) || []).length, 2)
  assert.doesNotMatch(html, /https?:\/\/|maplibre|fetch\(|window\.location/)
  assert.doesNotMatch(html, /<a\s|<iframe|src=/)
})
test('unknown/invalid coverage and any approved publication status fail closed', () => {
  const invalid = coverage()
  invalid.counts.publicationApproved = 1
  assert.throws(() => buildResearchHeatmap(invalid), /Expected unapproved/)
  const wrongTotal = coverage()
  wrongTotal.counts.insideNcr = 999
  assert.throws(() => buildResearchHeatmap(wrongTotal), /Grid\/source totals/)
  const invalidAccess = coverage()
  invalidAccess.grid.cells[0].restricted = 5
  assert.throws(
    () => buildResearchHeatmap(invalidAccess),
    /Grid\/source totals/,
  )
  const missingGeometry = coverage()
  missingGeometry.grid.cells[1].bbox = null
  assert.throws(
    () => buildResearchHeatmap(missingGeometry),
    /Grid\/source totals/,
  )
})
test('preview is repeatable and does not mutate input', () => {
  const input = coverage()
  const before = JSON.stringify(input)
  assert.equal(buildResearchHeatmap(input), buildResearchHeatmap(input))
  assert.equal(JSON.stringify(input), before)
})
