import assert from 'node:assert/strict'
import test from 'node:test'

import { watchConfirmation } from './confirmation-watch.ts'

function setup(check) {
  let clock = 0
  let serial = 0
  const timers = new Map()
  const events = []
  const watch = watchConfirmation({
    check,
    now: () => clock,
    setTimer: (work, delay) => {
      const id = ++serial
      timers.set(id, { work, delay })
      return id
    },
    clearTimer: (id) => {
      timers.delete(id)
    },
    checking: () => events.push('checking'),
    waiting: () => events.push('waiting'),
    confirmed: () => events.push('confirmed'),
    expired: () => events.push('expired'),
    failed: () => events.push('failed'),
  })
  return {
    watch,
    events,
    timers,
    setTime(value) {
      clock = value
    },
    async tick() {
      const entry = [...timers.entries()][0]
      assert.ok(entry)
      timers.delete(entry[0])
      clock += entry[1].delay
      entry[1].work()
      await Promise.resolve()
      await Promise.resolve()
    },
  }
}

test('pending checks back off and verified success stops the timer', async () => {
  let calls = 0
  const s = setup(async () => ++calls === 3)
  assert.equal([...s.timers.values()][0].delay, 5000)
  await s.tick()
  assert.equal([...s.timers.values()][0].delay, 10000)
  await s.tick()
  assert.equal([...s.timers.values()][0].delay, 20000)
  await s.tick()
  assert.deepEqual(s.events, [
    'checking',
    'waiting',
    'checking',
    'waiting',
    'checking',
    'confirmed',
  ])
  assert.equal(s.timers.size, 0)
})

test('manual checks do not overlap an in-flight request', async () => {
  let resolve
  let calls = 0
  const pending = new Promise((r) => {
    resolve = r
  })
  const s = setup(() => {
    calls++
    return pending
  })
  const first = s.watch.checkNow()
  await s.watch.checkNow()
  assert.equal(calls, 1)
  resolve(false)
  await first
  assert.equal(s.timers.size, 1)
})

test('leaving/backgrounding cancels timers and ignores a late verified response', async () => {
  let resolve
  const s = setup(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  const pending = s.watch.checkNow()
  s.watch.stop()
  resolve(true)
  await pending
  assert.equal(s.timers.size, 0)
  assert.deepEqual(s.events, ['checking'])
  await s.watch.checkNow()
  assert.deepEqual(s.events, ['checking'])
})

test('ten-minute bound expires without another credential request', async () => {
  let calls = 0
  const s = setup(async () => {
    calls++
    return false
  })
  s.setTime(600000)
  await s.watch.checkNow()
  assert.deepEqual(s.events, ['expired'])
  assert.equal(calls, 0)
  assert.equal(s.timers.size, 0)
})

test('network/rate-limit/credential failure stops automatic retries after one error', async () => {
  const s = setup(async () => {
    throw new Error('request failed')
  })
  await s.watch.checkNow()
  await s.watch.checkNow()
  assert.deepEqual(s.events, ['checking', 'failed'])
  assert.equal(s.timers.size, 0)
})
