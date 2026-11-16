#!/usr/bin/env node
/**
 * Parkey Figma snapshot exporter. No third-party dependencies; Node 24+.
 *
 * Source of node IDs: design-reference/manifest.json (60 known paired screens).
 * Network: Figma REST API (NOT MCP). All API calls are opt-in via CLI.
 * No credentials or expiring Figma render URLs are written to disk.
 */
import { Buffer } from 'node:buffer'
import console from 'node:console'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { URL, URLSearchParams, fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import process from 'node:process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DESIGN = join(ROOT, 'design-reference')
const MANIFEST = join(DESIGN, 'manifest.json')
const INDEX = join(DESIGN, 'export-index.json')
const API = 'https://api.figma.com/v1'
const fetch = globalThis.fetch
const AbortSignal = globalThis.AbortSignal
const DEFAULT_DELAY_MS = 8000
const BATCH_SIZE = 5
const THEMES = ['light-magenta', 'dark-magenta']

function assert(value, reason) {
  if (!value) throw new Error(reason)
}

export function nodeNameToSlug(id) {
  assert(/^(?:[0-9]+[A-Z]?|EXT)$/.test(id), 'Invalid screen ID: ' + id)
  return id.toLowerCase()
}

export function parseOptions(argv) {
  const out = {
    plan: false, check: false, all: false, assets: false, fills: false,
    noImages: false, screens: null, theme: 'both', scale: 1,
    delayMs: DEFAULT_DELAY_MS
  }
  for (const arg of argv) {
    if (arg === '--plan') out.plan = true
    else if (arg === '--check') out.check = true
    else if (arg === '--all') out.all = true
    else if (arg === '--assets') out.assets = true
    else if (arg === '--fills') out.fills = true
    else if (arg === '--no-images') out.noImages = true
    else if (arg.startsWith('--screens=')) out.screens = arg.slice(10).split(',').map(x => x.trim()).filter(Boolean)
    else if (arg.startsWith('--theme=')) out.theme = arg.slice(8)
    else if (arg.startsWith('--scale=')) out.scale = Number(arg.slice(8))
    else if (arg.startsWith('--delay-ms=')) out.delayMs = Number(arg.slice(11))
    else if (arg === '--help' || arg === '-h') {
      out.help = true
    } else throw new Error('Unknown argument: ' + arg)
  }
  assert(['both', ...THEMES].includes(out.theme), '--theme must be both, light-magenta or dark-magenta')
  assert(Number.isFinite(out.scale) && out.scale >= 0.01 && out.scale <= 4, '--scale must be between 0.01 and 4')
  assert(Number.isInteger(out.delayMs) && out.delayMs >= DEFAULT_DELAY_MS, 'Do not reduce --delay-ms below 8000; avoid REST rate-limit bursts')
  assert(!(out.all && out.screens), 'Choose --all or --screens, not both')
  assert(!(out.check && (out.all || out.screens || out.assets || out.fills)), '--check is read-only')
  return out
}

export function validateManifest(data) {
  assert(data.schemaVersion === 1, 'Unsupported manifest schema')
  assert(/^[A-Za-z0-9]{22,128}$/.test(data.fileKey), 'Invalid Figma file key')
  assert(Array.isArray(data.screenPairs) && data.screenPairs.length === 60, 'Expected 60 screen pairs')
  const keys = new Set()
  const ids = new Set()
  for (const pair of data.screenPairs) {
    nodeNameToSlug(pair.id)
    assert(!keys.has(pair.id), 'Duplicate screen ID ' + pair.id)
    keys.add(pair.id)
    assert(typeof pair.label === 'string' && pair.label.length > 0, 'Missing screen label')
    for (const ref of [pair.lightNodeId, pair.darkNodeId]) {
      assert(/^\d+:\d+$/.test(ref), 'Invalid node ref: ' + ref)
      assert(!ids.has(ref), 'Duplicate Figma node ref: ' + ref)
      ids.add(ref)
    }
  }
  assert(ids.size === 120, 'Expected 120 distinct Figma nodes')
  return data
}

export function selectScreens(manifest, options) {
  const pairs = options.all || !options.screens
    ? manifest.screenPairs
    : manifest.screenPairs.filter(pair => options.screens.includes(pair.id))
  if (options.screens) {
    const found = new Set(pairs.map(p => p.id))
    for (const id of options.screens) assert(found.has(id), 'Unknown screen ID: ' + id)
  }
  const themes = options.theme === 'both' ? THEMES : [options.theme]
  return pairs.flatMap(pair => themes.map(theme => ({
    id: pair.id, label: pair.label, theme,
    nodeId: theme === 'light-magenta' ? pair.lightNodeId : pair.darkNodeId
  })))
}

export function simplifyNode(node) {
  if (!node || typeof node !== 'object') return null
  const props = [
    'id','name','type','visible','opacity','rotation','absoluteBoundingBox',
    'relativeTransform','size','constraints','clipsContent',
    'layoutMode','layoutWrap','itemSpacing','counterAxisSpacing','primaryAxisAlignItems',
    'counterAxisAlignItems','primaryAxisSizingMode','counterAxisSizingMode',
    'layoutAlign','layoutGrow','layoutPositioning',
    'paddingLeft','paddingRight','paddingTop','paddingBottom',
    'cornerRadius','rectangleCornerRadii','strokeWeight','strokeAlign',
    'strokeDashes','blendMode','characters','style','characterStyleOverrides',
    'styleOverrideTable','textAutoResize','componentId','componentProperties',
    'reactions','styles','exportSettings','boundVariables',
    'componentPropertyReferences','layoutSizingHorizontal','layoutSizingVertical',
    'minWidth','maxWidth','minHeight','maxHeight','textTruncation','textCase'
  ]
  const out = {}
  for (const key of props) if (node[key] !== undefined) out[key] = node[key]
  for (const key of ['fills', 'strokes', 'effects']) {
    if (Array.isArray(node[key])) out[key] = node[key]
  }
  if (Array.isArray(node.children)) {
    out.children = node.children.map(simplifyNode)
  }
  return out
}

export function imageReferences(tree) {
  const refs = new Set()
  function visit(node) {
    for (const paint of [...(node.fills || []), ...(node.strokes || [])]) {
      if (paint.type === 'IMAGE' && typeof paint.imageRef === 'string') refs.add(paint.imageRef)
    }
    for (const child of node.children || []) visit(child)
  }
  visit(tree)
  return refs
}

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}
async function json(path) { return JSON.parse(await readFile(path, 'utf8')) }
async function exists(path) { try { await stat(path); return true } catch { return false } }
async function save(path, bytes) {
  await mkdir(dirname(path), { recursive: true })
  const tmp = path + '.tmp'
  await writeFile(tmp, bytes)
  await rename(tmp, path)
}
const sleep = ms => delay(ms)

class FigmaClient {
  constructor(token, delayMs) {
    assert(token && !token.includes('\n'), 'Set FIGMA_ACCESS_TOKEN in your local environment; never commit it.')
    this.token = token
    this.delayMs = delayMs
    this.last = 0
  }
  async api(path) {
    let lastError
    for (let attempt = 0; attempt < 5; attempt++) {
      const remaining = this.delayMs - (Date.now() - this.last)
      if (remaining > 0) await sleep(remaining)
      this.last = Date.now()
      let response
      try {
        response = await fetch(API + path, {
          headers: { 'X-Figma-Token': this.token, Accept: 'application/json' },
          signal: AbortSignal.timeout(60000)
        })
      } catch (error) {
        lastError = error
        if (attempt < 4) { await sleep(2000 * (attempt + 1)); continue }
        break
      }
      if (response.ok) return response.json()
      if (response.status === 429 || response.status >= 500) {
        const retry = Number(response.headers.get('retry-after'))
        const waitMs = Number.isFinite(retry) && retry > 0 ? retry * 1000 : 15000 * (attempt + 1)
        lastError = new Error('Figma REST HTTP ' + response.status + '; rate/availability limit')
        if (attempt < 4) { await sleep(Math.min(waitMs, 300000)); continue }
        break
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error('Figma REST access denied (' + response.status + '). Check file permissions, token scope and plan limits.')
      }
      throw new Error('Figma REST HTTP ' + response.status + ' for ' + path.split('?')[0])
    }
    throw lastError || new Error('Figma REST request failed')
  }
  async download(url) {
    const parsed = new URL(url)
    assert(parsed.protocol === 'https:', 'Asset downloads require HTTPS')
    assert(!/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(parsed.hostname), 'Refusing a local/private asset host')
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
    assert(response.ok, 'Figma render asset download failed: HTTP ' + response.status)
    const body = Buffer.from(await response.arrayBuffer())
    assert(body.length > 0 && body.length < 25 * 1024 * 1024, 'Empty or oversized render asset')
    return { body, contentType: response.headers.get('content-type') || '' }
  }
}

function fileFor(screen, kind) {
  const ext = kind === 'screen' ? '.png' : '.json'
  const folder = kind === 'screen' ? 'screens' : 'layouts'
  return join(DESIGN, folder, screen.theme, nodeNameToSlug(screen.id) + ext)
}
function rel(path) { return path.slice(DESIGN.length + 1).replaceAll('\\', '/') }
function qs(ids, extras = {}) {
  const params = new URLSearchParams({ ids: ids.join(','), ...extras })
  return params.toString()
}
function imageFormat(body, contentType) {
  if (body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return '.png'
  if (body[0] === 0xff && body[1] === 0xd8) return '.jpg'
  if (body.subarray(0, 4).toString() === 'RIFF' && body.subarray(8, 12).toString() === 'WEBP') return '.webp'
  if (contentType.includes('image/svg+xml') || body.subarray(0, 256).toString().includes('<svg')) return '.svg'
  throw new Error('Unknown image data format; refusing to save file')
}
async function loadIndex() {
  if (await exists(INDEX)) {
    const result = await json(INDEX)
    assert(result.schemaVersion === 1, 'Unknown export index schema')
    return result
  }
  return { schemaVersion: 1, fileKey: null, updatedAt: null, entries: {}, assets: {} }
}

async function verify(manifest, targets) {
  const index = await loadIndex()
  const missing = [], invalid = []
  for (const screen of targets) {
    const key = screen.theme + '/' + screen.id
    const record = index.entries[key]
    if (!record || record.nodeId !== screen.nodeId) { missing.push(key); continue }
    for (const kind of ['metadata', 'screenshot']) {
      const item = record[kind]
      if (!item) { missing.push(key + ':' + kind); continue }
      const path = resolve(DESIGN, item.path)
      if (!path.startsWith(DESIGN + sep)) { invalid.push(key + ':' + kind); continue }
      try {
        const contents = await readFile(path)
        if (digest(contents) !== item.sha256) invalid.push(key + ':' + kind)
      } catch { missing.push(key + ':' + kind) }
    }
  }
  console.log(JSON.stringify({ screens: targets.length, missing: missing.length, invalid: invalid.length, missingItems: missing.slice(0, 30), invalidItems: invalid.slice(0, 30) }, null, 2))
  return missing.length === 0 && invalid.length === 0
}

async function exportScreenBatch(client, manifest, index, batch, opts, fillRefs) {
  const ids = batch.map(x => x.nodeId)
  const nodesResponse = await client.api('/files/' + manifest.fileKey + '/nodes?' + qs(ids))
  for (const screen of batch) {
    const node = nodesResponse.nodes?.[screen.nodeId]?.document
    assert(node && node.id === screen.nodeId, 'Figma did not return node ' + screen.nodeId)
    const clean = simplifyNode(node)
    for (const imageRef of imageReferences(clean)) fillRefs.add(imageRef)
    const document = {
      schemaVersion: 1, fileKey: manifest.fileKey, fileVersion: nodesResponse.version ?? null,
      fetchedAt: new Date().toISOString(), screenId: screen.id,
      theme: screen.theme, nodeId: screen.nodeId, label: screen.label, node: clean
    }
    const path = fileFor(screen, 'layout')
    const data = Buffer.from(JSON.stringify(document, null, 2) + '\n')
    await save(path, data)
    const entry = index.entries[screen.theme + '/' + screen.id] || {}
    entry.nodeId = screen.nodeId
    entry.metadata = { path: rel(path), sha256: digest(data), fileVersion: nodesResponse.version ?? null }
    index.entries[screen.theme + '/' + screen.id] = entry
  }
  if (!opts.noImages) {
    const result = await client.api('/images/' + manifest.fileKey + '?' + qs(ids, { format: 'png', scale: String(opts.scale) }))
    for (const screen of batch) {
      const imageUrl = result.images?.[screen.nodeId]
      if (!imageUrl) throw new Error('Figma did not render ' + screen.nodeId + '; metadata already saved')
      const { body } = await client.download(imageUrl)
      assert(imageFormat(body, 'image/png') === '.png', 'Screen render was not a PNG')
      const path = fileFor(screen, 'screen')
      await save(path, body)
      const entry = index.entries[screen.theme + '/' + screen.id]
      entry.screenshot = { path: rel(path), sha256: digest(body), scale: opts.scale }
    }
  }
  index.fileKey = manifest.fileKey
  index.updatedAt = new Date().toISOString()
  await save(INDEX, JSON.stringify(index, null, 2) + '\n')
  console.log('Exported ' + batch.map(s => s.theme + '/' + s.id).join(', '))
}

async function exportAssets(client, manifest, index) {
  const selection = await json(join(DESIGN, 'assets', 'selection.json'))
  assert(Array.isArray(selection.assets), 'assets/selection.json needs an assets array')
  const seen = new Set()
  for (const asset of selection.assets) {
    assert(/^\d+:\d+$/.test(asset.nodeId), 'Invalid selected asset node ID')
    assert(/^[a-z0-9][a-z0-9_-]{0,63}$/.test(asset.name), 'Asset name must be a safe lowercase slug')
    assert(['svg', 'png'].includes(asset.format), 'Asset format must be svg or png')
    assert(!seen.has(asset.name), 'Duplicate asset name')
    seen.add(asset.name)
  }
  for (let start = 0; start < selection.assets.length; start += BATCH_SIZE) {
    const batch = selection.assets.slice(start, start + BATCH_SIZE)
    const formatGroups = new Map()
    for (const asset of batch) (formatGroups.get(asset.format) || (formatGroups.set(asset.format, []), formatGroups.get(asset.format))).push(asset)
    for (const [format, group] of formatGroups) {
      const res = await client.api('/images/' + manifest.fileKey + '?' + qs(group.map(x => x.nodeId), { format, scale: '1' }))
      for (const asset of group) {
        const url = res.images?.[asset.nodeId]
        assert(url, 'Selected asset could not render: ' + asset.name)
        const { body, contentType } = await client.download(url)
        assert(imageFormat(body, contentType) === '.' + format, 'Selected asset returned unexpected bytes')
        const path = join(DESIGN, 'assets', 'exported', asset.name + '.' + format)
        await save(path, body)
        index.assets[asset.name] = { nodeId: asset.nodeId, path: rel(path), sha256: digest(body), format }
      }
    }
    index.updatedAt = new Date().toISOString()
    await save(INDEX, JSON.stringify(index, null, 2) + '\n')
  }
  console.log('Exported ' + selection.assets.length + ' curated assets')
}

async function exportFills(client, manifest, index, refs) {
  if (!refs.size) { console.log('No image fills found in selected screens'); return }
  const result = await client.api('/files/' + manifest.fileKey + '/images')
  for (const imageRef of refs) {
    const url = result.images?.[imageRef]
    if (!url) { console.warn('Image fill not resolved: ' + imageRef); continue }
    const { body, contentType } = await client.download(url)
    const ext = imageFormat(body, contentType)
    const safe = digest(Buffer.from(imageRef)).slice(0, 24)
    const path = join(DESIGN, 'assets', 'fills', safe + ext)
    await save(path, body)
    index.assets['fill:' + imageRef] = { imageRef, path: rel(path), sha256: digest(body), format: ext.slice(1) }
  }
  index.updatedAt = new Date().toISOString()
  await save(INDEX, JSON.stringify(index, null, 2) + '\n')
  console.log('Processed ' + refs.size + ' image-fill references')
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseOptions(argv)
  const manifest = validateManifest(await json(MANIFEST))
  if (opts.help) {
    console.log('Usage: node scripts/figma-snapshot.mjs --plan | --check | --all [--theme=both] [--no-images] [--fills] [--assets] | --screens=21,22,25 [options]')
    console.log('Set FIGMA_ACCESS_TOKEN locally for export. Min API delay is 8000 ms. --check verifies all screen pairs.')
    return
  }
  const targets = selectScreens(manifest, opts)
  if (opts.plan || (!opts.check && !opts.all && !opts.screens && !opts.assets)) {
    console.log(JSON.stringify({
      selectedScreens: targets.length, batchSize: BATCH_SIZE,
      estimatedNodeCalls: Math.ceil(targets.length / BATCH_SIZE),
      estimatedImageCalls: opts.noImages ? 0 : Math.ceil(targets.length / BATCH_SIZE),
      requiresFigmaAccessTokenToExport: true,
      exportAlreadyCompleted: await exists(INDEX),
      note: 'REST API quota is separate from MCP, but still rate-limited. This is an estimate, not a current quota check.'
    }, null, 2))
    return
  }
  if (opts.check) {
    if (!(await verify(manifest, targets))) process.exitCode = 1
    return
  }
  const client = new FigmaClient(process.env.FIGMA_ACCESS_TOKEN, opts.delayMs)
  const index = await loadIndex()
  const fills = new Set()
  for (let start = 0; start < (opts.all || opts.screens ? targets.length : 0); start += BATCH_SIZE) {
    await exportScreenBatch(client, manifest, index, targets.slice(start, start + BATCH_SIZE), opts, fills)
  }
  if (opts.assets) await exportAssets(client, manifest, index)
  if (opts.fills) await exportFills(client, manifest, index, fills)
  if (opts.noImages) console.log('Metadata only; run again without --no-images to obtain screenshots.')
  console.log('Snapshot complete for requested selection. Use --check after exporting all 120 frames.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error('Figma snapshot failed: ' + error.message); process.exitCode = 1 })
}
