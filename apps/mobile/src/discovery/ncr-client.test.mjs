import assert from 'node:assert/strict'
import test from 'node:test'

import {
  fetchNcrPage,
  isNcrResponse,
  ncrPreviewEnabled,
  ncrResponseCanDisplay,
} from './ncr-client.ts'
import { ncrMapSources } from './ncr-map-data.ts'

// Synthetic API fixtures exercise the display contract; they are not research evidence.
const item = {
  id: 'test:polygon',
  name: 'Synthetic facility',
  featureType: 'lot',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [121, 14.5],
        [121.01, 14.5],
        [121.01, 14.51],
        [121, 14.5],
      ],
    ],
  },
  representativePoint: [121.005, 14.505],
  pointIsVehicleEntrance: false,
  canNavigate: false,
  accessClass: 'unknown',
  restrictedAccess: false,
  evidence: {
    researchStatus: 'researched',
    onlineCorroborated: false,
    operatorConfirmed: false,
    physicallyVerified: false,
    publicationApproved: false,
  },
  publicationReview: { approvedAt: null, reviewDueAt: null },
  source: {
    kind: 'osm',
    url: 'https://www.openstreetmap.org/way/1',
    license: 'ODbL-1.0',
    attribution: 'OpenStreetMap contributors',
    observedAt: null,
  },
  warnings: ['representative_point_not_entrance'],
  reviewIssueIds: ['test:review'],
  fees: null,
  hours: null,
  capacity: null,
  liveAvailability: null,
}
const result = {
  schemaVersion: 1,
  mode: 'research_preview',
  dataVersion: 'test-version',
  generatedAt: '2026-11-05T00:00:00Z',
  reviewDueAt: null,
  coverage: {
    sourceAsOf: '2026-11-03T00:00:00Z',
    boundarySource: 'test',
    scope: 'NCR',
  },
  items: [item],
  clusters: [],
  nextCursor: null,
  truncated: false,
  totalMatched: 1,
  attribution: [
    { label: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' },
  ],
  notice: 'Synthetic research contract test',
}
const viewport = {
  west: 120.95,
  south: 14.45,
  east: 121.05,
  north: 14.55,
  zoom: 15,
}

test('private preview requires development and loopback app/server origins', () => {
  assert.equal(
    ncrPreviewEnabled('development', 'http://127.0.0.1:8090', 'localhost'),
    true,
  )
  for (const [environment, url, app] of [
    ['production', 'http://127.0.0.1:8090', 'localhost'],
    ['development', 'https://example.com', 'localhost'],
    ['development', 'http://127.0.0.1:8090', 'example.com'],
    ['development', 'http://owner:secret@localhost:8090', 'localhost'],
    ['development', 'http://localhost:8090/private', 'localhost'],
  ])
    assert.equal(ncrPreviewEnabled(environment, url, app), false)
})
test('source geometry and distinct feature roles survive; anchors do not become entrances', () => {
  const sources = ncrMapSources(result, item.id)
  assert.deepEqual(sources.shapes.features[0].geometry, item.geometry)
  assert.equal(sources.anchors.features[0].geometry.type, 'Point')
  assert.equal(sources.anchors.features[0].properties.featureType, 'lot')
  assert.equal(item.canNavigate, false)
  assert.equal(isNcrResponse(result), true)
  for (const patch of [
    { canNavigate: true },
    { fees: 'free' },
    { capacity: 10 },
    { evidence: {} },
    { geometry: { type: 'Point', coordinates: [NaN, 14.5] } },
    { featureType: 'shop' },
  ])
    assert.equal(
      isNcrResponse({ ...result, items: [{ ...item, ...patch }] }),
      false,
    )
})
test('viewport requests cancel, retain unknown facts and reject public leakage or wrong modes', async () => {
  const original = globalThis.fetch,
    controller = new globalThis.AbortController()
  try {
    globalThis.fetch = async (url, options) => {
      assert.match(String(url), /research-preview\?bbox=/)
      assert.equal(options.signal, controller.signal)
      assert.equal(options.cache, 'no-store')
      assert.equal(
        options.headers['X-Parkey-Research-Preview'],
        'local-development',
      )
      return new globalThis.Response(JSON.stringify(result))
    }
    assert.deepEqual(
      await fetchNcrPage(
        'http://127.0.0.1:8090',
        viewport,
        'all',
        'research_preview',
        controller.signal,
      ),
      result,
    )
    globalThis.fetch = async () =>
      new globalThis.Response(JSON.stringify({ ...result, mode: 'public' }))
    await assert.rejects(
      fetchNcrPage(
        'http://127.0.0.1:8090',
        viewport,
        'all',
        'public',
        controller.signal,
      ),
      /publication checks/,
    )
    globalThis.fetch = async () =>
      new globalThis.Response(JSON.stringify(result))
    await assert.rejects(
      fetchNcrPage(
        'http://127.0.0.1:8090',
        viewport,
        'all',
        'public',
        controller.signal,
      ),
      /unsupported response/,
    )
    globalThis.fetch = async () =>
      new globalThis.Response('Unavailable', { status: 503 })
    await assert.rejects(
      fetchNcrPage(
        'http://127.0.0.1:8090',
        viewport,
        'all',
        'research_preview',
        controller.signal,
      ),
      /503/,
    )
  } finally {
    globalThis.fetch = original
  }
})

test('mode transitions and approval expiry fail closed even if a stale request resolves', () => {
  assert.equal(ncrResponseCanDisplay(result, 'public'), false)
  const now = Date.parse('2026-11-05T03:00:00Z')
  const approved = {
    ...result,
    mode: 'public',
    reviewDueAt: '2026-11-05T04:00:00Z',
    items: [
      {
        ...item,
        reviewIssueIds: [],
        evidence: { ...item.evidence, publicationApproved: true },
        publicationReview: {
          approvedAt: '2026-11-05T02:00:00Z',
          reviewDueAt: '2026-11-05T04:00:00Z',
        },
      },
    ],
  }
  assert.equal(ncrResponseCanDisplay(approved, 'public', now), true)
  assert.equal(
    ncrResponseCanDisplay(
      approved,
      'public',
      Date.parse('2026-11-05T04:00:00Z'),
    ),
    false,
  )
  assert.equal(
    ncrResponseCanDisplay(
      {
        ...approved,
        items: [{ ...approved.items[0], restrictedAccess: true }],
      },
      'public',
      now,
    ),
    false,
  )
})
