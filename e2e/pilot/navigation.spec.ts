import { test, expect, openPilot, openResults } from './fixtures'

test('Entrance has its own Back layer and retains the selected guarded record', async ({
  page,
}) => {
  await openPilot(page)
  await openResults(page)
  await page.getByTestId('pilot-record-qa-Manila').click()
  await page
    .getByRole('button', { name: 'View Parking Details', exact: true })
    .click()
  await page.getByRole('tab', { name: 'Entrance', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Entrance & Access', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Get Directions', exact: true }),
  ).toBeDisabled()
  await page.goBack()
  await expect(page.getByTestId('pilot-details')).toContainText(
    'Parking near Manila Test Museum',
  )
  await page.getByRole('tab', { name: 'Entrance', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pilot-details')).toBeVisible()
})

test('full-page pilot List has browser Back and Escape, with an inert retained map', async ({
  page,
}) => {
  await openPilot(page)
  const canvas = await page.locator('.maplibregl-canvas').elementHandle()
  await openResults(page)
  await expect(page.getByTestId('pilot-list-page')).toBeVisible()
  await expect(page.getByTestId('ncr-map-ready')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  expect(
    await page
      .getByTestId('ncr-map-ready')
      .evaluate((node) => (node as HTMLElement).inert),
  ).toBe(true)
  await page.goBack()
  await expect(page.getByTestId('pilot-list-page')).toHaveCount(0)
  await openResults(page)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pilot-list-page')).toHaveCount(0)
  expect(
    await canvas?.evaluate(
      (node) => node === document.querySelector('.maplibregl-canvas'),
    ),
  ).toBe(true)
  await page.getByRole('tab', { name: 'Profile', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Account', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Appearance', exact: true }),
  ).toBeVisible()
  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'Appearance', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Account', exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('heading', { name: 'Account', exact: true }),
  ).toHaveCount(0)
})
