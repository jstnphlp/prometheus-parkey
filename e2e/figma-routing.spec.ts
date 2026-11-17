import { mkdir } from 'node:fs/promises'

import { test, expect, installNavigationSensor, openSpot } from './fixtures'

test.use({ reviewedNavigation: true, viewport: { width: 430, height: 932 } })
const evidence = 'docs/evidence/figma-exact/browser'

for (const mode of ['light-magenta', 'dark-magenta'] as const) {
  test(`${mode}: share, navigation chooser, consent and persistent active route`, async ({
    page,
    context,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('parkey.appearance.v1', value),
      mode,
    )
    await context.grantPermissions([
      'geolocation',
      'clipboard-read',
      'clipboard-write',
    ])
    await installNavigationSensor(page)
    await openSpot(page)
    await mkdir(evidence, { recursive: true })
    await page.getByRole('button', { name: 'Share', exact: true }).click()
    await expect(
      page.getByRole('heading', {
        name: 'Share Parking Location',
        exact: true,
      }),
    ).toBeVisible()
    await page.screenshot({ path: `${evidence}/${mode}-27.png`, scale: 'css' })
    await page
      .getByRole('button', { name: 'Copy details', exact: true })
      .click()
    await expect(
      page
        .getByRole('dialog')
        .getByText('Parking information copied', { exact: true }),
    ).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      '1210',
    )
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    const routeRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/route/v1/driving/'))
        routeRequests.push(request.url())
    })
    await page.getByTestId('parking-get-directions').click()
    await expect(page.getByTestId('directions-choice')).toBeVisible()
    expect(routeRequests).toEqual([])
    await page.screenshot({ path: `${evidence}/${mode}-29.png`, scale: 'css' })
    await page
      .getByRole('button', { name: 'Navigate with Parkey', exact: true })
      .click()
    const consent = page.getByRole('alertdialog', {
      name: 'Directions privacy',
    })
    await expect(consent).toBeVisible()
    expect(routeRequests).toEqual([])
    await consent.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByTestId('navigation-banner')).toContainText(
      'Turn left onto Test Street',
    )
    await page.screenshot({ path: `${evidence}/${mode}-30.png`, scale: 'css' })
    const canvas = await page.locator('.maplibregl-canvas').elementHandle()
    await page
      .getByTestId('route-panel')
      .getByRole('button', { name: 'Appearance', exact: true })
      .click()
    const opposite =
      mode === 'light-magenta' ? 'Dark + Magenta' : 'Light + Magenta'
    await page.getByRole('radio', { name: opposite, exact: true }).click()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByTestId('navigation-banner')).toContainText(
      'Turn left onto Test Street',
    )
    await expect(page.getByTestId('route-panel')).toContainText('650 m')
    expect(
      await canvas?.evaluate(
        (node) => node === document.querySelector('.maplibregl-canvas'),
      ),
    ).toBe(true)
    expect(routeRequests).toHaveLength(1)
  })
}
