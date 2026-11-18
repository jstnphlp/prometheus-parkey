import { mkdir } from 'node:fs/promises'

import { test, expect, openPilot, openResults } from './fixtures'

test('pilot themes preserve selected public parking and the map instance', async ({
  page,
}, info) => {
  await openPilot(page)
  await openResults(page)
  await page.getByTestId('pilot-record-qa-Manila').click()
  await page
    .getByRole('button', { name: 'View Parking Details', exact: true })
    .click()
  const details = page.getByTestId('pilot-details')
  await expect(details).toContainText('Parking near Manila Test Museum')
  const canvas = await page.locator('.maplibregl-canvas').elementHandle()
  await details.getByRole('button', { name: 'Appearance', exact: true }).click()
  for (const [label, scheme] of [
    ['Dark + Magenta', 'dark'],
    ['Light + Magenta', 'light'],
  ] as const) {
    await page.getByRole('radio', { name: label, exact: true }).click()
    await expect(
      page.getByRole('radio', { name: label, exact: true }),
    ).toBeChecked()
    await expect(page.locator('html')).toHaveCSS('color-scheme', scheme)
  }
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(details).toContainText('Parking near Manila Test Museum')
  expect(
    await canvas?.evaluate(
      (node) => node === document.querySelector('.maplibregl-canvas'),
    ),
  ).toBe(true)
  await mkdir('docs/evidence/figma-exact/pilot/interaction', {
    recursive: true,
  })
  await page.screenshot({
    path: `docs/evidence/figma-exact/pilot/interaction/${info.project.name}-light-magenta-25.png`,
  })
})
