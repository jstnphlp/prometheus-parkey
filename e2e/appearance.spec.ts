import { mkdir } from 'node:fs/promises'

import {
  test,
  expect,
  openMap,
  openSpot,
  spot,
  installNavigationSensor,
} from './fixtures'

const evidence = 'docs/evidence/figma-exact/browser/interaction'
for (const mode of ['light-magenta', 'dark-magenta'] as const) {
  test(`${mode}: theme changes preserve selected parking, saved data and map instance`, async ({
    page,
  }, info) => {
    await page.addInitScript((value) => {
      if (!localStorage.getItem('parkey.appearance.v1'))
        localStorage.setItem('parkey.appearance.v1', value)
    }, mode)
    await openSpot(page)
    await page
      .getByRole('button', { name: 'Save parking', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Remove from favorites', exact: true }),
    ).toBeVisible()
    const canvas = await page.locator('.maplibregl-canvas').elementHandle()
    const url = page.url()
    await page
      .getByRole('button', { name: 'Appearance', exact: true })
      .filter({ visible: true })
      .last()
      .click()
    const opposite = mode === 'light-magenta' ? 'dark-magenta' : 'light-magenta'
    const label =
      opposite === 'dark-magenta' ? 'Dark + Magenta' : 'Light + Magenta'
    await page.getByRole('radio', { name: label, exact: true }).click()
    await expect(
      page.getByRole('radio', { name: label, exact: true }),
    ).toBeChecked()
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem('parkey.appearance.v1')),
      )
      .toBe(opposite)
    await expect(page.locator('html')).toHaveCSS(
      'color-scheme',
      opposite === 'dark-magenta' ? 'dark' : 'light',
    )
    await mkdir(evidence, { recursive: true })
    await page.screenshot({
      path: `${evidence}/${info.project.name}-${opposite}-16A.png`,
    })
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(url)
    await expect(page.getByTestId('parking-detail-title')).toHaveText(spot.name)
    await expect(
      page.getByRole('button', { name: 'Remove from favorites', exact: true }),
    ).toBeVisible()
    expect(
      await canvas?.evaluate(
        (node) => node === document.querySelector('.maplibregl-canvas'),
      ),
    ).toBe(true)
    await page.screenshot({
      path: `${evidence}/${info.project.name}-${opposite}-23.png`,
    })
    // The initialization script leaves an existing preference intact.
    await page.goto('/appearance')
    await expect(
      page.getByRole('radio', { name: label, exact: true }),
    ).toBeChecked()
  })

  test(`${mode}: search drafts, local settings, long inputs and guest entry`, async ({
    page,
  }, info) => {
    await page.addInitScript((value) => {
      if (!localStorage.getItem('parkey.appearance.v1'))
        localStorage.setItem('parkey.appearance.v1', value)
    }, mode)
    await openMap(page)
    await page
      .getByRole('button', { name: 'Search parking or landmark', exact: true })
      .click()
    await page.getByTestId('destination-query').fill('Poblacion')
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('tab', { name: 'Profile', exact: true }).click()
    await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('tab', { name: 'Explore', exact: true }).click()
    await page
      .getByRole('button', { name: 'Search parking or landmark', exact: true })
      .click()
    await expect(page.getByTestId('destination-query')).toHaveValue('Poblacion')
    await page.goto('/settings')
    await expect(
      page.getByRole('heading', { name: 'Account', exact: true }),
    ).toBeVisible()
    await mkdir(evidence, { recursive: true })
    await page.screenshot({
      path: `${evidence}/${info.project.name}-${mode}-16.png`,
    })
    await page.getByRole('button', { name: 'My Vehicles', exact: true }).click()
    await expect(
      page.getByText('Vehicle management is not available yet'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: 'Help Center', exact: true }).click()
    await page
      .getByRole('button', { name: 'Do I need an account?', exact: true })
      .click()
    await expect(
      page.getByText(
        'No. Explore, search, saved parking and directions are available without registration.',
      ),
    ).toBeVisible()
    await page.goto('/login')
    const closeMessage = page.getByRole('button', {
      name: 'Close message',
      exact: true,
    })
    if (await closeMessage.isVisible()) await closeMessage.click()
    const email = page.getByRole('textbox', {
      name: 'Email address',
      exact: true,
    })
    await email.fill('a'.repeat(100) + '@example.test')
    const field = page.getByTestId('auth-email-address-container')
    expect(
      await field.evaluate(
        (node) => node.getBoundingClientRect().right <= window.innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: `${evidence}/${info.project.name}-${mode}-17-long-email.png`,
    })
    await page.goto('/welcome')
    await page
      .getByRole('button', { name: 'Explore parking', exact: true })
      .click()
    await expect(page.getByTestId('discovery-map-ready')).toBeVisible()
    await expect(
      page.getByRole('tab', { name: 'Explore', exact: true }),
    ).toBeVisible()
    await page.screenshot({
      path: `${evidence}/${info.project.name}-${mode}-22.png`,
    })
  })
}

test('appearance persists across relaunch; invalid preference safely falls back', async ({
  page,
}) => {
  await page.goto('/appearance')
  await page.getByRole('radio', { name: 'Dark + Magenta', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('parkey.appearance.v1')),
    )
    .toBe('dark-magenta')
  await page.reload()
  await expect(
    page.getByRole('radio', { name: 'Dark + Magenta', exact: true }),
  ).toBeChecked()
  await page.evaluate(() =>
    localStorage.setItem('parkey.appearance.v1', 'invalid'),
  )
  await page.reload()
  await expect(
    page.getByRole('radio', { name: 'Light + Magenta', exact: true }),
  ).toBeChecked()
})

test('a failed preference write keeps the current theme and offers a truthful retry', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'parkey.appearance.v1')
        throw new DOMException('Test storage failure', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page.goto('/appearance')
  await page.getByRole('radio', { name: 'Dark + Magenta', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Could not save it')
  await expect(
    page.getByRole('radio', { name: 'Dark + Magenta', exact: true }),
  ).toBeChecked()
  await expect(
    page.getByText('Saved on this device. You can change it anytime.'),
  ).toHaveCount(0)
})

test.describe('active navigation appearance', () => {
  test.use({ reviewedNavigation: true })
  test('switching modes keeps the consented route and map mounted', async ({
    page,
  }, info) => {
    await installNavigationSensor(page)
    await openSpot(page)
    await page.getByTestId('parking-get-directions').click()
    await page
      .getByRole('button', { name: 'Navigate with Parkey', exact: true })
      .click()
    await page
      .getByRole('alertdialog', { name: 'Directions privacy' })
      .getByRole('button', { name: 'Continue', exact: true })
      .click()
    await expect(page.getByTestId('navigation-banner')).toBeVisible()
    const canvas = await page.locator('.maplibregl-canvas').elementHandle()
    await page
      .getByTestId('route-panel')
      .getByRole('button', { name: 'Appearance', exact: true })
      .click()
    await page
      .getByRole('radio', { name: 'Dark + Magenta', exact: true })
      .click()
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
    await page.screenshot({
      path: `${evidence}/${info.project.name}-dark-magenta-30.png`,
    })
  })
})
