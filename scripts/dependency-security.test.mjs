import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const merge = require('deepmerge')
test('patched deepmerge cannot poison returned object prototypes from null-prototype input', () => {
  const payload = JSON.parse(
    '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"ordinary":1}',
  )
  for (const target of [
    {},
    Object.create(null),
    JSON.parse('{"__proto__":{"targetPoison":true}}'),
  ]) {
    const result = merge(target, payload)
    assert.equal(result.polluted, undefined)
    assert.equal(result.targetPoison, undefined)
    assert.equal(Object.getPrototypeOf(result), Object.prototype)
    assert.equal(result.ordinary, 1)
  }
  assert.deepEqual(
    merge({ nested: { a: 1 }, list: [1] }, { nested: { b: 2 }, list: [2] }),
    { nested: { a: 1, b: 2 }, list: [1, 2] },
  )
})
