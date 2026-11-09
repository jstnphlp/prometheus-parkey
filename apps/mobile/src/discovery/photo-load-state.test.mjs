import assert from 'node:assert/strict'
import test from 'node:test'

import { createPhotoLoadSession } from './photo-load-state.ts'

function scheduler() {
  let next = 0
  const callbacks = new Map()
  return {
    callbacks,
    schedule(callback, delay) {
      const id = ++next
      callbacks.set(id, { callback, delay })
      return id
    },
    cancel(id) {
      callbacks.delete(id)
    },
    fire() {
      for (const [id, { callback }] of callbacks) {
        callbacks.delete(id)
        callback()
      }
    },
  }
}

test('successful and failed image events settle once and clear loading deadlines', () => {
  for (const [event, expected] of [
    ['loaded', 'ready'],
    ['failed', 'error'],
  ]) {
    const timer = scheduler()
    const changes = []
    const session = createPhotoLoadSession(
      (status) => changes.push(status),
      timer,
    )
    assert.equal(timer.callbacks.size, 1)
    session[event]()
    assert.equal(timer.callbacks.size, 0)
    session.loaded()
    session.failed()
    timer.fire()
    assert.deepEqual(changes, [expected])
  }
})

test('a hanging image becomes unavailable and a late load cannot restore it', () => {
  const timer = scheduler()
  const changes = []
  const session = createPhotoLoadSession((status) => changes.push(status), {
    ...timer,
    timeoutMs: 4500,
  })
  assert.equal([...timer.callbacks.values()][0].delay, 4500)
  timer.fire()
  session.loaded()
  assert.deepEqual(changes, ['error'])
  assert.equal(timer.callbacks.size, 0)
})

test('changing record/photo disposes the old attempt and isolates stale callbacks', () => {
  const timer = scheduler()
  const first = []
  const second = []
  const previous = createPhotoLoadSession((status) => first.push(status), timer)
  const staleTimeout = [...timer.callbacks.values()][0].callback
  previous.dispose()
  assert.equal(timer.callbacks.size, 0)
  const current = createPhotoLoadSession((status) => second.push(status), timer)
  previous.loaded()
  previous.failed()
  staleTimeout()
  assert.deepEqual(first, [])
  assert.deepEqual(second, [])
  current.loaded()
  current.dispose()
  assert.deepEqual(second, ['ready'])
  assert.equal(timer.callbacks.size, 0)
})

test('invalid timeouts use a finite deadline and unmount clears all work', () => {
  for (const timeoutMs of [0, -1, NaN, Infinity]) {
    const timer = scheduler()
    const session = createPhotoLoadSession(() => assert.fail('Unmounted'), {
      ...timer,
      timeoutMs,
    })
    assert.equal([...timer.callbacks.values()][0].delay, 8000)
    session.dispose()
    session.dispose()
    timer.fire()
    session.loaded()
    assert.equal(timer.callbacks.size, 0)
  }
})
