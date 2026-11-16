import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

import { parseThemeMode, semanticColors, themes } from '../theme-colors.ts'

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../../../design-reference/tokens/figma-tokens.json',
      import.meta.url,
    ),
    'utf8',
  ),
)
const roles = {
  canvas: 'background/canvas',
  surface: 'background/surface',
  card: 'background/card',
  text: 'text/primary',
  secondary: 'text/secondary',
  border: 'border/default',
  primary: 'action/primary',
  brand: 'action/brand',
  mapCanvas: 'map/canvas',
  mapBlock: 'map/block',
  mapRoad: 'map/road',
  pending: 'status/pending',
  verified: 'status/verified',
  accentSoft: 'background/accent-soft',
  onAction: 'text/on-action',
  marker: 'map/marker',
  navigationActive: 'navigation/active',
  navigationInactive: 'navigation/inactive',
  back: 'navigation/back',
}
function luminance(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}
for (const mode of ['light-magenta', 'dark-magenta']) {
  test(`${mode}: all 19 roles match the checked-in Figma snapshot`, () => {
    assert.equal(Object.keys(semanticColors[mode]).length, 19)
    for (const [role, key] of Object.entries(roles))
      assert.equal(semanticColors[mode][role], snapshot.modes[mode][key], key)
  })
  test(`${mode}: text, validation and primary actions meet normal-text contrast`, () => {
    const { tokens, colors } = themes[mode]
    for (const background of [tokens.canvas, tokens.card, tokens.surface]) {
      for (const foreground of [
        tokens.text,
        tokens.secondary,
        tokens.pending,
        colors.error,
      ])
        assert.ok(
          contrast(foreground, background) >= 4.5,
          `${foreground} on ${background}`,
        )
    }
    assert.ok(contrast(tokens.onAction, tokens.primary) >= 4.5)
    assert.equal(colors.onAction, '#FFFFFF')
    assert.ok(contrast(colors.link, colors.soft) >= 3, 'unfilled action icons')
    assert.ok(
      contrast(
        themes[mode].mapColors.label,
        themes[mode].mapColors.labelHalo,
      ) >= 4.5,
      'labels on the unchanged basemap',
    )
  })
}
test('only the two explicit magenta preferences are restored; damaged or absent storage falls back to light', () => {
  assert.equal(parseThemeMode('dark-magenta'), 'dark-magenta')
  assert.equal(parseThemeMode('light-magenta'), 'light-magenta')
  for (const value of [null, undefined, 'dark', 'teal', '{}', '', 1])
    assert.equal(parseThemeMode(value), 'light-magenta')
})
