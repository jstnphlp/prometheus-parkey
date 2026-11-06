import { test, expect } from './fixtures'
import {
  mockExternalConsole,
  researchConsoleUrl,
  watchResearchReads,
} from './research-handoff-fixtures'

// The first route can compile both Expo's server and browser bundles on Windows.
test.setTimeout(120_000)

test('research handoff opens only the configured external console and keeps discovery available', async ({
  page,
  context,
}) => {
  const researchReads = watchResearchReads(page)
  await mockExternalConsole(context)
  await page.goto('/ncr-research')
  const handoff = page.getByRole('link', {
    name: 'Open Research Console in browser',
  })
  await expect(handoff).toBeVisible()
  const popupPromise = page.waitForEvent('popup')
  await handoff.click()
  const popup = await popupPromise
  await expect(popup).toHaveURL(researchConsoleUrl)
  await expect(
    popup.getByRole('heading', { name: 'External console navigation fixture' }),
  ).toBeVisible()
  expect(await popup.evaluate(() => window.opener)).toBeNull()
  await expect(page).toHaveURL(/\/ncr-research$/)
  await expect(page.getByTestId('ncr-map-ready')).toHaveCount(0)
  await expect(page.getByTestId('ncr-selected-details')).toHaveCount(0)
  expect(researchReads).toEqual([])
  await popup.close()

  await page
    .getByRole('link', { name: 'Return to Parkey mobile discovery' })
    .click()
  await expect(page.getByTestId('destination-query')).toBeVisible()
  await expect(page.getByTestId('discovery-map-ready')).toBeVisible()
  expect(researchReads).toEqual([])
})

test('failed external browser opening is recoverable without exposing research inside mobile', async ({
  page,
  context,
}) => {
  const researchReads = watchResearchReads(page)
  await mockExternalConsole(context)
  await page.addInitScript(() => {
    const open = window.open.bind(window)
    let firstAttempt = true
    window.open = (...args: Parameters<typeof window.open>) => {
      if (firstAttempt) {
        firstAttempt = false
        throw new Error('Synthetic browser-open failure for this test only')
      }
      return open(...args)
    }
  })
  await page.goto('/ncr-research')
  const handoff = page.getByRole('link', {
    name: 'Open Research Console in browser',
  })
  await handoff.click()
  await expect(page.getByRole('alert')).toHaveText(
    'Could not open the browser link.',
  )
  await expect(page).toHaveURL(/\/ncr-research$/)
  await expect(page.getByTestId('ncr-map-ready')).toHaveCount(0)
  expect(researchReads).toEqual([])

  const popupPromise = page.waitForEvent('popup')
  await handoff.click()
  const popup = await popupPromise
  await expect(popup).toHaveURL(researchConsoleUrl)
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(researchReads).toEqual([])
  await popup.close()
})
