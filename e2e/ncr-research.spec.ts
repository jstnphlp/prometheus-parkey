import { test, expect } from './fixtures'

// NCR research no longer belongs in the Expo app; full source/API checks
// are retained in the independent parkey-research-console repository.
test('legacy NCR route only points to separate research console; never bundles or shows research candidates', async ({ page }) => {
  const unauthorizedCalls: string[] = []
  page.on('request', (request) => {
    if (/\/api\/ncr\/(research-preview|discovery)/.test(request.url()))
      unauthorizedCalls.push(request.url())
  })
  await page.goto('/ncr-research')
  await expect(page.getByRole('heading', { name: 'Research Console is now on the web' })).toBeVisible()
  await expect(page.getByTestId('research-console-not-configured')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open private research' })).toHaveCount(0)
  await expect(page.getByTestId('ncr-selected-details')).toHaveCount(0)
  expect(unauthorizedCalls).toEqual([])
  await page.getByRole('link', { name: 'Return to Parkey mobile discovery' }).click()
  await expect(page.getByTestId('destination-query')).toBeVisible()
})
