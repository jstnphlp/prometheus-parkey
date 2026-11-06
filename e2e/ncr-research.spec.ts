import { test, expect } from './fixtures'
import { watchResearchReads } from './research-handoff-fixtures'

// NCR research no longer belongs in the Expo app; full source/API checks
// are retained in the independent parkey-research-console repository.
test('legacy NCR route only points to separate research console; never bundles or shows research candidates', async ({
  page,
}) => {
  const unauthorizedCalls = watchResearchReads(page)
  await page.goto('/ncr-research')
  await expect(
    page.getByRole('heading', { name: 'Research Console is now on the web' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Open Research Console in browser' }),
  ).toBeVisible()
  await expect(page.getByTestId('research-console-not-configured')).toHaveCount(
    0,
  )
  await expect(
    page.getByText(
      'Research observations are unverified and are not available parking, legal visitor access, or navigation entrances.',
    ),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Open private research' }),
  ).toHaveCount(0)
  await expect(page.getByTestId('ncr-selected-details')).toHaveCount(0)
  await expect(page.getByTestId('ncr-map-ready')).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  expect(unauthorizedCalls).toEqual([])
  await page
    .getByRole('link', { name: 'Return to Parkey mobile discovery' })
    .click()
  await expect(page.getByTestId('destination-query')).toBeVisible()
})
