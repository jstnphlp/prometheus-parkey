import assert from 'node:assert/strict'
import test from 'node:test'

import { readBody, reviewRequest } from './validation.ts'

const report = '11111111-1111-4111-8111-111111111111'
test('review requests reject reviewer impersonation, mass assignment and invalid operations', () => {
  assert.equal(reviewRequest({ operation: 'list' }).operation, 'list')
  for (const value of [
    { operation: 'list', reviewer: report },
    { operation: 'delete' },
    { operation: 'accepted', report, reason: 'x' },
    { operation: 'published', report, reason: 'Reviewed' },
  ])
    assert.throws(() => reviewRequest(value))
})
test('publication requires public HTTPS provenance without embedded credentials', () => {
  const body = {
    operation: 'published',
    report,
    reason: 'Reviewed signage',
    public_url: 'https://example.org/source',
    public_license: 'CC BY 4.0',
    public_attribution: 'Contributor',
  }
  assert.equal(reviewRequest(body).public_url, body.public_url)
  for (const public_url of [
    'http://example.org',
    'https://user:pass@example.org',
    'javascript:alert(1)',
  ])
    assert.throws(() => reviewRequest({ ...body, public_url }))
})
test('bounded JSON rejects oversized, malformed, non-JSON and untrusted bodies', async () => {
  const request = (body) =>
    new Request('https://example.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  assert.deepEqual(await readBody(request('{"operation":"list"}')), {
    operation: 'list',
  })
  await assert.rejects(readBody(request(' '.repeat(8193))), RangeError)
  await assert.rejects(readBody(request('{')), SyntaxError)
  await assert.rejects(
    readBody(
      new Request('https://example.org', { method: 'POST', body: '{}' }),
    ),
    TypeError,
  )
})

test('queue pagination is bounded and cannot select arbitrary private statuses', () => {
  assert.equal(
    reviewRequest({ operation: 'list', queue_status: 'accepted', page: 1 })
      .page,
    1,
  )
  for (const value of [
    { page: -1 },
    { page: 1.5 },
    { page: 1001 },
    { page: '1' },
    { queue_status: 'rejected' },
  ])
    assert.throws(() => reviewRequest({ operation: 'list', ...value }))
})
