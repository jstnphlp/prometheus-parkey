import { mkdir } from 'node:fs/promises'

import { test, expect, openMap, openSpot, spot } from './fixtures'

const evidence = 'docs/evidence/figma-exact/browser'
test.use({ viewport: { width: 430, height: 932 } })

for (const mode of ['light-magenta', 'dark-magenta'] as const) {
  test(`${mode}: architecture geometry, map/list, preview, full-page settings and state`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      if (!localStorage.getItem('parkey.appearance.v1'))
        localStorage.setItem('parkey.appearance.v1', value)
    }, mode)
    await openMap(page)
    await mkdir(evidence, { recursive: true })
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ scale: 'css', path: `${evidence}/${mode}-22.png` })
    const map = await page.locator('.maplibregl-canvas').elementHandle()
    await page
      .getByRole('button', { name: 'Show parking list', exact: true })
      .first()
      .click()
    await expect(page.getByTestId('parking-list-page')).toBeVisible()
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ scale: 'css', path: `${evidence}/${mode}-21.png` })
    await page.getByRole('tab', { name: 'Map', exact: true }).click()
    await expect(page.getByTestId('parking-list-page')).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Filter parking', exact: true })
      .click()
    await page
      .getByRole('checkbox', { name: 'Covered parking', exact: true })
      .click()
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ scale: 'css', path: `${evidence}/${mode}-22B.png` })
    await page
      .getByRole('button', { name: 'Apply Filters', exact: true })
      .click()
    await expect(page).toHaveURL(/features=covered/)
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
    await page.screenshot({ scale: 'css', path: `${evidence}/${mode}-16.png` })
    await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Appearance', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ scale: 'css', path: `${evidence}/${mode}-16A.png` })
    const opposite =
      mode === 'light-magenta' ? 'Dark + Magenta' : 'Light + Magenta'
    await page.getByRole('radio', { name: opposite, exact: true }).click()
    await expect(
      page.getByRole('radio', { name: opposite, exact: true }),
    ).toBeChecked()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Account', exact: true }),
    ).toBeVisible()
    await page.getByRole('tab', { name: 'Explore', exact: true }).click()
    await expect(page).toHaveURL(/features=covered/)
    expect(
      await map?.evaluate(
        (node) => node === document.querySelector('.maplibregl-canvas'),
      ),
    ).toBe(true)
  })

  test(`${mode}: selection, saved parking, preview/details Back and search draft`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('parkey.appearance.v1', value),
      mode,
    )
    await openSpot(page, false)
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ scale: 'css', path: `${evidence}/${mode}-23.png` })
    await page
      .getByRole('button', { name: 'View Parking Details', exact: true })
      .click()
    await expect(page.getByTestId('parking-details-page')).toBeVisible()
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ scale: 'css', path: `${evidence}/${mode}-25.png` })
    await page
      .getByRole('button', { name: 'Save parking', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'View Saved Parking', exact: true }),
    ).toBeVisible()
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ scale: 'css', path: `${evidence}/${mode}-26.png` })
    await page
      .getByRole('button', { name: 'Back to parking preview', exact: true })
      .click()
    await expect(page.getByTestId('parking-preview')).toBeVisible()
    await expect(page.getByTestId('parking-detail-title')).toHaveText(spot.name)
    await page.getByRole('tab', { name: 'Saved', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Saved', exact: true }),
    ).toBeVisible()
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ scale: 'css', path: `${evidence}/${mode}-26B.png` })
    await page.getByRole('button', { name: 'View', exact: true }).click()
    await expect(page.getByTestId('parking-details-page')).toBeVisible()
    await page.getByRole('tab', { name: 'Entrance', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Entrance & Access', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Get Directions', exact: true }),
    ).toBeDisabled()
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ scale: 'css', path: `${evidence}/${mode}-28.png` })
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page
      .getByRole('button', { name: 'Back to parking preview', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Search parking or landmark', exact: true })
      .click()
    await page.getByTestId('destination-query').fill('Poblacion')
    await expect(page.getByTestId('destination-result-0')).toContainText(
      'Poblacion Test Cafe',
    )
    await expect(
      page.getByText('Added to Saved Parking', { exact: true }),
    ).toHaveCount(0)
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ scale: 'css', path: `${evidence}/${mode}-22A.png` })
    await page
      .getByRole('button', { name: 'Back', exact: true })
      .first()
      .click()
    await expect(page.getByTestId('parking-preview')).toBeVisible()
    await page
      .getByRole('button', { name: 'Search parking or landmark', exact: true })
      .click()
    await expect(page.getByTestId('destination-query')).toHaveValue('Poblacion')
  })

  test(`${mode}: welcome, skippable walkthrough and long email geometry`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('parkey.appearance.v1', value),
      mode,
    )
    await page.goto('/welcome')
    await expect(
      page.getByRole('heading', { name: 'Welcome', exact: true }),
    ).toBeVisible()
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ scale: 'css', path: `${evidence}/${mode}-1B.png` })
    await page.getByRole('button', { name: 'Get Started', exact: true }).click()
    for (const id of ['2', '3', '4']) {
      await expect(
        page.getByRole('heading', { name: /Step .* of 3/ }),
      ).toBeVisible()
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((image) =>
            image.decode().catch(() => undefined),
          ),
        )
      })
      await page.screenshot({
        scale: 'css',
        path: `${evidence}/${mode}-${id}.png`,
      })
      await page
        .getByRole('button', {
          name: id === '4' ? 'Continue' : 'Next',
          exact: true,
        })
        .click()
    }
    await expect(page.getByTestId('discovery-map-ready')).toBeVisible()
    await page.goto('/login')
    const close = page.getByRole('button', {
      name: 'Close message',
      exact: true,
    })
    await expect(close).toBeVisible()
    await close.click()
    const email = page.getByRole('textbox', {
      name: 'Email address',
      exact: true,
    })
    await expect(email).toBeVisible()
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined),
        ),
      )
    })
    await page.screenshot({ scale: 'css', path: `${evidence}/${mode}-17.png` })
    const before = await page
      .getByTestId('auth-email-address-container')
      .boundingBox()
    await email.fill('a'.repeat(200) + '@example.test')
    const after = await page
      .getByTestId('auth-email-address-container')
      .boundingBox()
    expect(after).toEqual(before)
    expect(after!.x + after!.width).toBeLessThanOrEqual(430)
  })
}
