import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import test from 'node:test'

import {
  nodeNameToSlug, parseOptions, validateManifest, selectScreens,
  simplifyNode, imageReferences
} from './figma-snapshot.mjs'

const reference = resolve(dirname(fileURLToPath(import.meta.url)), '../design-reference')
const load = async name => JSON.parse(await readFile(resolve(reference, name), 'utf8'))

test('manifest has exactly 60 Figma magenta pairs with unique refs', async () => {
  const data = validateManifest(await load('manifest.json'))
  assert.equal(data.screenPairs.length, 60)
  const screens = selectScreens(data, parseOptions(['--all']))
  assert.equal(screens.length, 120)
  assert.equal(new Set(screens.map(x => x.nodeId)).size, 120)
  assert.deepEqual(new Set(screens.map(x => x.theme)), new Set(['light-magenta', 'dark-magenta']))
})

test('Figma magenta tokens are complete, distinct, and fixed-source', async () => {
  const tokens = await load('tokens/figma-tokens.json')
  assert.deepEqual(Object.keys(tokens.modes), ['light-magenta', 'dark-magenta'])
  for (const mode of Object.values(tokens.modes)) {
    assert.equal(Object.keys(mode).length, 19)
    for (const value of Object.values(mode)) assert.match(value, /^#[0-9A-F]{6}$/)
    assert.equal(mode['action/primary'], '#840561')
  }
  assert.equal(tokens.modes['light-magenta']['background/canvas'], '#FFFFFF')
  assert.equal(tokens.modes['dark-magenta']['background/canvas'], '#20162E')
})

test('CLI selects a paired screen without requiring Figma', async () => {
  const data = await load('manifest.json')
  const opts = parseOptions(['--screens=21,22A', '--theme=dark-magenta', '--no-images'])
  const selected = selectScreens(data, opts)
  assert.deepEqual(selected.map(x => x.nodeId), ['249:6399', '249:6533'])
  assert.equal(opts.noImages, true)
})

test('bad manifest duplicates and unknown screen IDs fail', async () => {
  const data = await load('manifest.json')
  assert.throws(() => selectScreens(data, parseOptions(['--screens=999'])), /Unknown screen/)
  const corrupt = JSON.parse(JSON.stringify(data))
  corrupt.screenPairs[1].darkNodeId = corrupt.screenPairs[0].lightNodeId
  assert.throws(() => validateManifest(corrupt), /Duplicate Figma node/)
})

test('CLI rejects unsafe args and rate-limit override', () => {
  assert.throws(() => parseOptions(['--delay-ms=1']), /8000/)
  assert.throws(() => parseOptions(['--theme=teal']), /theme/)
  assert.throws(() => parseOptions(['--scale=8']), /scale/)
  assert.throws(() => parseOptions(['--not-a-real-flag']), /Unknown argument/)
  assert.equal(nodeNameToSlug('22A'), '22a')
  assert.throws(() => nodeNameToSlug('../secrets'), /Invalid screen ID/)
})

test('node simplifier preserves interactive layout hierarchy and image refs', () => {
  const tree = {
    id: '1:2', name: 'Root', type: 'FRAME', layoutMode: 'VERTICAL',
    bogusPrivateApiField: 'discard me',
    children: [{
      id: '1:3', name: 'Title', type: 'TEXT', characters: 'Parkey',
      absoluteBoundingBox: { x: 10, y: 20, width: 100, height: 30 },
      fills: [{ type: 'IMAGE', imageRef: 'abc' }],
      reactions: [{ action: { type: 'NODE' }, trigger: { type: 'ON_CLICK' } }],
      children: []
    }]
  }
  const clean = simplifyNode(tree)
  assert.equal(clean.bogusPrivateApiField, undefined)
  assert.equal(clean.children[0].characters, 'Parkey')
  assert.equal(clean.children[0].reactions[0].trigger.type, 'ON_CLICK')
  assert.deepEqual([...imageReferences(clean)], ['abc'])
})

test('navigation graph is product-aware and references valid screen IDs', async () => {
  const graph = await load('flows/navigation.json')
  const manifest = await load('manifest.json')
  const ids = new Set(manifest.screenPairs.map(x => x.id))
  for (const edge of graph.transitions) {
    assert.ok(ids.has(edge.from), 'unknown transition source ' + edge.from)
    assert.ok(ids.has(edge.to), 'unknown transition target ' + edge.to)
    assert.ok(['v1','gated','illustrative'].includes(edge.status))
  }
  assert.ok(graph.transitions.some(e => e.action === 'continue-as-guest'))
})
