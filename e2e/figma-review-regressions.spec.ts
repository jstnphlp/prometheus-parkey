import type { Route } from '@playwright/test'

import { test, expect, openMap, openSpot } from './fixtures'

test.describe('reviewed saved parking', () => {
  test.use({ reviewedNavigation: true })
  test('Saved Directions closes the collection and opens the real chooser', async ({
    page,
  }) => {
    await openSpot(page)
    await page
      .getByRole('button', { name: 'Save parking', exact: true })
      .click()
    await page.goto('/?panel=saved')
    const directions = page.getByRole('button', {
      name: 'Directions',
      exact: true,
    })
    await expect(directions).toBeEnabled()
    await directions.click()
    await expect(page.getByTestId('directions-choice')).toBeVisible()
    await expect(page).not.toHaveURL(/panel=saved/)
    await page
      .getByRole('button', { name: 'Back from directions', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Saved', exact: true }),
    ).toBeVisible()
  })
})

test('Map style failure has a visible retry and retains guest discovery', async ({
  page,
}) => {
  const outage = (route: Route) =>
    route.fulfill({ status: 503, body: 'Synthetic map outage' })
  await page.route('https://e2e.parkey.test/map-style.json', outage)
  await page.goto('/')
  await expect(
    page.getByText(
      'The map could not load. You can still open the parking list.',
      { exact: true },
    ),
  ).toBeVisible()
  await page.unroute('https://e2e.parkey.test/map-style.json', outage)
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByTestId('discovery-map-ready')).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: 'Search parking or landmark',
      exact: true,
    }),
  ).toBeVisible()
})

test('Show all spots clears feature filters as well as kind and fee filters', async ({
  page,
}) => {
  await openMap(page)
  await page
    .getByRole('button', { name: 'Filter parking', exact: true })
    .click()
  for (const feature of [
    'Covered parking',
    'Open 24 hours',
    'EV charging',
    'Accessibility (PWD)',
  ])
    await page.getByRole('checkbox', { name: feature, exact: true }).click()
  await page.getByRole('button', { name: 'Apply Filters', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'No parking found', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Back to map', exact: true }).click()
  await page
    .getByRole('button', { name: 'Show parking list', exact: true })
    .first()
    .click()
  await page
    .getByRole('button', { name: 'Show all spots', exact: true })
    .click()
  await expect(page).not.toHaveURL(/features=/)
  await expect(page.getByTestId(/^parking-row-/).first()).toBeVisible()
})
