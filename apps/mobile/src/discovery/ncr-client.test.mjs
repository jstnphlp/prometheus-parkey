import assert from 'node:assert/strict'
import test from 'node:test'

import {
  fetchNcrPage,
  fetchNcrDataset,
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

const datasetItem = (index) => ({ ...item, id: `synthetic:${index}` })
const datasetPage = (items, patch = {}) => ({ ...result, items, ...patch })

test('complete NCR loader fetches every bounded detail page once and preserves source facts', async () => {
  const original = globalThis.fetch
  const controller = new globalThis.AbortController()
  const expected = Array.from({ length: 502 }, (_, i) => datasetItem(i))
  const progress = []
  const requests = []
  try {
    globalThis.fetch = async (input, options) => {
      const url = new globalThis.URL(input)
      requests.push(url)
      assert.equal(url.searchParams.get('bbox'), '120.85,14.3,121.27,14.86')
      assert.equal(url.searchParams.get('zoom'), '20')
      assert.equal(url.searchParams.get('category'), 'all')
      assert.equal(url.searchParams.get('limit'), '500')
      assert.equal(options.signal, controller.signal)
      assert.equal(options.cache, 'no-store')
      assert.equal(
        options.headers['X-Parkey-Research-Preview'],
        'local-development',
      )
      return new globalThis.Response(
        JSON.stringify(
          requests.length === 1
            ? datasetPage(expected.slice(0, 500), {
                totalMatched: 502,
                nextCursor: 'second-page',
                truncated: true,
              })
            : datasetPage(expected.slice(500), {
                totalMatched: 502,
                generatedAt: '2026-11-05T00:00:01Z',
              }),
        ),
      )
    }
    const complete = await fetchNcrDataset(
      'http://127.0.0.1:8090',
      'research_preview',
      controller.signal,
      (loaded, total) => progress.push([loaded, total]),
    )
    assert.equal(requests.length, 2)
    assert.equal(requests[0].searchParams.has('cursor'), false)
    assert.equal(requests[1].searchParams.get('cursor'), 'second-page')
    assert.deepEqual(progress, [
      [500, 502],
      [502, 502],
    ])
    assert.deepEqual(complete.items, expected)
    assert.equal(complete.nextCursor, null)
    assert.equal(complete.truncated, false)
    assert.equal(complete.totalMatched, 502)
    assert.equal(complete.generatedAt, '2026-11-05T00:00:01Z')
    assert.deepEqual(complete.coverage, result.coverage)
    assert.deepEqual(complete.attribution, result.attribution)
    assert.equal(ncrResponseCanDisplay(complete, 'research_preview'), true)
    assert.equal(
      isNcrResponse(complete),
      false,
      'wire page limit stays 500; the completed in-memory dataset may be larger',
    )
  } finally {
    globalThis.fetch = original
  }
})

test('complete NCR loader rejects changed snapshot, coverage, licensing or approval metadata', async () => {
  const original = globalThis.fetch
  try {
    for (const patch of [
      { dataVersion: 'changed-source' },
      { totalMatched: 3 },
      { coverage: { ...result.coverage, sourceAsOf: '2026-11-04T00:00:00Z' } },
      {
        attribution: [
          { label: 'Changed attribution', url: 'https://example.com/changed' },
        ],
      },
      { notice: 'Changed publication policy' },
      { reviewDueAt: '2026-12-01T00:00:00Z' },
    ]) {
      let calls = 0
      globalThis.fetch = async () =>
        new globalThis.Response(
          JSON.stringify(
            ++calls === 1
              ? datasetPage([datasetItem(1)], {
                  totalMatched: 2,
                  nextCursor: 'second',
                  truncated: true,
                })
              : datasetPage([datasetItem(2)], { totalMatched: 2, ...patch }),
          ),
        )
      await assert.rejects(
        fetchNcrDataset(
          'http://127.0.0.1:8090',
          'research_preview',
          new globalThis.AbortController().signal,
        ),
        /snapshot changed/,
      )
    }
  } finally {
    globalThis.fetch = original
  }
})

test('complete NCR loader refuses repeated IDs/cursors, stalled pages, clusters and incomplete totals', async () => {
  const original = globalThis.fetch
  const first = datasetPage([datasetItem(1)], {
    totalMatched: 4,
    nextCursor: 'second',
    truncated: true,
  })
  const scenarios = [
    [
      first,
      datasetPage([datasetItem(1)], {
        totalMatched: 4,
        nextCursor: 'third',
        truncated: true,
      }),
    ],
    [
      first,
      datasetPage([datasetItem(2)], {
        totalMatched: 4,
        nextCursor: 'second',
        truncated: true,
      }),
    ],
    [
      first,
      datasetPage([], {
        totalMatched: 4,
        nextCursor: 'third',
        truncated: true,
      }),
    ],
    [first, datasetPage([datasetItem(2)], { totalMatched: 4 })],
    [datasetPage([datasetItem(1)], { totalMatched: 0 })],
    [
      datasetPage([datasetItem(1)], {
        totalMatched: 1,
        nextCursor: 'extra',
        truncated: true,
      }),
    ],
    [
      datasetPage([datasetItem(1)], {
        totalMatched: 2,
        nextCursor: 'second',
        truncated: false,
      }),
    ],
    [
      datasetPage([], {
        totalMatched: 1,
        clusters: [
          {
            id: 'synthetic-cluster',
            coordinate: [121, 14.5],
            sourceObservationCount: 1,
            facilityCandidateCount: 1,
            byType: { lot: 1 },
          },
        ],
      }),
    ],
  ]
  try {
    for (const pages of scenarios) {
      let calls = 0
      globalThis.fetch = async () => {
        assert.ok(
          calls < pages.length,
          'bad pagination must stop before any extra request',
        )
        return new globalThis.Response(JSON.stringify(pages[calls++]))
      }
      await assert.rejects(
        fetchNcrDataset(
          'http://127.0.0.1:8090',
          'research_preview',
          new globalThis.AbortController().signal,
        ),
        /duplicate record IDs|repeated a pagination cursor|incomplete dataset|invalid detail pagination/,
      )
    }
  } finally {
    globalThis.fetch = original
  }
})

test('complete NCR loader aborts before requests and between pages without returning partial records', async () => {
  const original = globalThis.fetch
  try {
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      return new globalThis.Response(JSON.stringify(result))
    }
    const before = new globalThis.AbortController()
    before.abort()
    await assert.rejects(
      fetchNcrDataset(
        'http://127.0.0.1:8090',
        'research_preview',
        before.signal,
      ),
      { name: 'AbortError' },
    )
    assert.equal(calls, 0)
    const between = new globalThis.AbortController()
    globalThis.fetch = async () => {
      calls++
      return new globalThis.Response(
        JSON.stringify(
          datasetPage([datasetItem(1)], {
            totalMatched: 2,
            nextCursor: 'second',
            truncated: true,
          }),
        ),
      )
    }
    await assert.rejects(
      fetchNcrDataset(
        'http://127.0.0.1:8090',
        'research_preview',
        between.signal,
        () => between.abort(),
      ),
      { name: 'AbortError' },
    )
    assert.equal(calls, 1)
    const during = new globalThis.AbortController()
    globalThis.fetch = async () => {
      during.abort()
      return new globalThis.Response(JSON.stringify(result))
    }
    await assert.rejects(
      fetchNcrDataset(
        'http://127.0.0.1:8090',
        'research_preview',
        during.signal,
      ),
      { name: 'AbortError' },
    )
  } finally {
    globalThis.fetch = original
  }
})

test('complete public snapshot stays empty unless every returned record passes publication checks', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async (input, options) => {
      assert.equal(new globalThis.URL(input).pathname, '/api/ncr/discovery')
      assert.deepEqual(options.headers, {})
      return new globalThis.Response(
        JSON.stringify({
          ...result,
          mode: 'public',
          items: [],
          totalMatched: 0,
        }),
      )
    }
    assert.equal(
      (
        await fetchNcrDataset(
          'http://127.0.0.1:8090',
          'public',
          new globalThis.AbortController().signal,
        )
      ).items.length,
      0,
    )
    globalThis.fetch = async () =>
      new globalThis.Response(JSON.stringify({ ...result, mode: 'public' }))
    await assert.rejects(
      fetchNcrDataset(
        'http://127.0.0.1:8090',
        'public',
        new globalThis.AbortController().signal,
      ),
      /publication checks/,
    )
  } finally {
    globalThis.fetch = original
  }
})
