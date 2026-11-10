import assert from 'node:assert/strict'
import test from 'node:test'

import { createLocalMapBenchmark } from './local-map-benchmark.ts'

test('measurement requires explicit development opt-in and remains silent in release', () => {
  for (const [environment, requested, releaseBuild] of [
    ['production', 'true', ''],
    ['production', 'true', 'true'],
    ['test', 'true', ''],
    ['development', '', ''],
    ['development', 'false', ''],
    ['development', 'TRUE', ''],
    ['development', 'true', 'true'],
  ]) {
    const mark = createLocalMapBenchmark({
      environment,
      requested,
      releaseBuild,
      now: () => assert.fail('Disabled benchmark must not read a clock'),
      write: () => assert.fail('Disabled benchmark must not emit output'),
    })
    mark()
    mark()
  }
})

test('fully rendered callback writes only elapsed milliseconds once per mount', () => {
  let time = 100
  const messages = []
  const options = {
    environment: 'development',
    requested: 'true',
    releaseBuild: '',
    now: () => time,
    write: (message) => messages.push(message),
  }
  const firstMount = createLocalMapBenchmark(options)
  time = 423.6
  firstMount()
  time = 900
  firstMount()
  assert.deepEqual(messages, ['PARKEY_LOCAL_MAP_READY 324'])
  const secondMount = createLocalMapBenchmark(options)
  time = 1100
  secondMount()
  assert.deepEqual(messages, [
    'PARKEY_LOCAL_MAP_READY 324',
    'PARKEY_LOCAL_MAP_READY 200',
  ])
})

test('invalid clocks and failing output cannot break map rendering or invent a duration', () => {
  const options = {
    environment: 'development',
    requested: 'true',
    releaseBuild: '',
  }
  for (const value of [NaN, Infinity, -Infinity, -1]) {
    const mark = createLocalMapBenchmark({
      ...options,
      now: () => value,
      write: () => assert.fail('Invalid start must not produce a measurement'),
    })
    assert.doesNotThrow(mark)
  }
  let time = 100
  const messages = []
  const mark = createLocalMapBenchmark({
    ...options,
    now: () => time,
    write: (message) => messages.push(message),
  })
  for (const value of [0, NaN, Infinity]) {
    time = value
    mark()
  }
  assert.deepEqual(messages, [])
  let writes = 0
  const failingOutput = createLocalMapBenchmark({
    ...options,
    now: () => 1,
    write: () => {
      writes += 1
      throw new Error('Local output unavailable')
    },
  })
  assert.doesNotThrow(failingOutput)
  assert.doesNotThrow(failingOutput)
  assert.equal(writes, 1)
  const failingClock = createLocalMapBenchmark({
    ...options,
    now: () => {
      throw new Error('Clock unavailable')
    },
  })
  assert.doesNotThrow(failingClock)
})
