import { mkdir } from 'node:fs/promises'

import { test, expect, openPilot, openResults, closeDetails } from './fixtures'

test.use({ viewport: { width: 430, height: 932 } })
const evidence = 'docs/evidence/figma-exact/pilot'

for (const mode of ['light-magenta', 'dark-magenta'] as const) {
  test(`${mode}: pilot map/list, preview, details and profile composition`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('parkey.appearance.v1', value),
      mode,
    )
    await openPilot(page)
    await openResults(page)
    await expect(page.getByTestId('pilot-record-qa-Manila')).toBeVisible()
    await mkdir(evidence, { recursive: true })
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ path: `${evidence}/${mode}-21.png`, scale: 'css' })
    await page
      .getByRole('button', { name: 'Show parking map', exact: true })
      .click()
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ path: `${evidence}/${mode}-22.png`, scale: 'css' })
    await openResults(page)
    await page.getByTestId('pilot-record-qa-Manila').click()
    await expect(page.getByTestId('parking-preview')).toBeVisible()
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ path: `${evidence}/${mode}-23.png`, scale: 'css' })
    await page
      .getByRole('button', { name: 'View Parking Details', exact: true })
      .click()
    await expect(page.getByTestId('pilot-directions')).toBeDisabled()
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ path: `${evidence}/${mode}-25.png`, scale: 'css' })
    await closeDetails(page)
    await page.getByRole('tab', { name: 'Profile', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Account', exact: true }),
    ).toBeVisible()
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ path: `${evidence}/${mode}-16.png`, scale: 'css' })
    await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ path: `${evidence}/${mode}-16A.png`, scale: 'css' })
    await expect(
      page.getByRole('radio', {
        name: mode === 'light-magenta' ? 'Light + Magenta' : 'Dark + Magenta',
        exact: true,
      }),
    ).toBeChecked()
  })
}
