import assert from 'node:assert/strict'
import test from 'node:test'

import { createPublicRequestPool } from './public-request-pool.ts'

const { AbortController } = globalThis
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

test('concurrent callers share a parsed value and settled entries are removed', async () => {
  const pool = createPublicRequestPool(),
    pending = deferred()
  let loads = 0
  const load = () => {
    loads++
    return pending.promise
  }
  const first = pool.run('public-viewport', new AbortController().signal, load)
  const second = pool.run('public-viewport', new AbortController().signal, load)
  assert.equal(loads, 1)
  const parsed = { records: [{ id: 'public-fixture' }] }
  pending.resolve(parsed)
  const [a, b] = await Promise.all([first, second])
  assert.equal(a, parsed)
  assert.equal(b, parsed)
  assert.deepEqual(
    await pool.run(
      'public-viewport',
      new AbortController().signal,
      async () => {
        loads++
        return { records: [] }
      },
    ),
    { records: [] },
  )
  assert.equal(loads, 2)
})

test('different ephemeral keys never share work', async () => {
  const pool = createPublicRequestPool(),
    a = deferred(),
    b = deferred()
  let loads = 0
  const first = pool.run(
    'backend-a/viewport-a',
    new AbortController().signal,
    () => {
      loads++
      return a.promise
    },
  )
  const second = pool.run(
    'backend-b/viewport-b',
    new AbortController().signal,
    () => {
      loads++
      return b.promise
    },
  )
  assert.equal(loads, 2)
  a.resolve('first')
  b.resolve('second')
  assert.deepEqual(await Promise.all([first, second]), ['first', 'second'])
})

test('canceling one subscriber leaves shared transport and other subscribers alive', async (t) => {
  const pool = createPublicRequestPool(),
    pending = deferred(),
    a = new AbortController(),
    b = new AbortController()
  const removeA = t.mock.method(a.signal, 'removeEventListener')
  const removeB = t.mock.method(b.signal, 'removeEventListener')
  let shared
  const load = (signal) => {
    shared = signal
    return pending.promise
  }
  const first = pool.run('viewport', a.signal, load)
  const second = pool.run('viewport', b.signal, load)
  const cancellation = assert.rejects(first, { name: 'AbortError' })
  a.abort()
  await cancellation
  assert.equal(shared.aborted, false)
  assert.equal(b.signal.aborted, false)
  pending.resolve('remaining-result')
  assert.equal(await second, 'remaining-result')
  assert.equal(removeA.mock.callCount(), 1)
  assert.equal(removeB.mock.callCount(), 1)
})

test('all cancellations abort transport and late completion cannot delete a replacement', async () => {
  const pool = createPublicRequestPool(),
    old = deferred(),
    replacement = deferred()
  const a = new AbortController(),
    b = new AbortController()
  let shared,
    loads = 0
  const first = pool.run('viewport', a.signal, (signal) => {
    shared = signal
    loads++
    return old.promise
  })
  const second = pool.run('viewport', b.signal, () => {
    throw new Error('Must share first load')
  })
  const canceled = Promise.all([
    assert.rejects(first, { name: 'AbortError' }),
    assert.rejects(second, { name: 'AbortError' }),
  ])
  a.abort()
  b.abort()
  await canceled
  assert.equal(shared.aborted, true)
  const next = pool.run('viewport', new AbortController().signal, () => {
    loads++
    return replacement.promise
  })
  old.resolve('ignored-old-result')
  await old.promise
  const joined = pool.run('viewport', new AbortController().signal, () => {
    throw new Error('Replacement entry was lost')
  })
  replacement.resolve('current-result')
  assert.deepEqual(await Promise.all([next, joined]), [
    'current-result',
    'current-result',
  ])
  assert.equal(loads, 2)
})

test('shared failures and synchronous loader throws clean up before retry', async () => {
  const pool = createPublicRequestPool(),
    pending = deferred()
  const first = pool.run(
    'viewport',
    new AbortController().signal,
    () => pending.promise,
  )
  const second = pool.run(
    'viewport',
    new AbortController().signal,
    () => pending.promise,
  )
  const failed = Promise.all([
    assert.rejects(first, /fixture failure/),
    assert.rejects(second, /fixture failure/),
  ])
  pending.reject(new Error('fixture failure'))
  await failed
  await assert.rejects(
    pool.run('viewport', new AbortController().signal, () => {
      throw new Error('sync fixture')
    }),
    /sync fixture/,
  )
  assert.equal(
    await pool.run(
      'viewport',
      new AbortController().signal,
      async () => 'recovered',
    ),
    'recovered',
  )
})

test('already canceled callers never start or subscribe to work', async () => {
  const pool = createPublicRequestPool(),
    canceled = new AbortController()
  canceled.abort()
  let loads = 0
  await assert.rejects(
    pool.run('viewport', canceled.signal, async () => {
      loads++
      return 'unexpected'
    }),
    { name: 'AbortError' },
  )
  assert.equal(loads, 0)
})
