import { test, expect } from './fixtures'

test('NCR development preview keeps actual candidates private and displays honest research geometry', async ({
  page,
}) => {
  const published = await page.request.get(
    'http://127.0.0.1:8090/api/ncr/discovery?bbox=120.85,14.3,121.27,14.86&zoom=15',
  )
  expect(published.ok()).toBe(true)
  const publicBody: unknown = await published.json()
  expect(publicBody).toMatchObject({
    mode: 'public',
    items: [],
    totalMatched: 0,
  })
  await page.goto('/ncr-research')
  await expect(page.getByTestId('ncr-map-ready')).toBeVisible({
    timeout: 15000,
  })
  await expect(page.getByTestId('ncr-empty')).toContainText(
    'No NCR records are approved',
  )
  await page
    .getByRole('button', { name: 'Open private research', exact: true })
    .click()
  await expect(page.getByTestId('ncr-result-summary')).toContainText(
    'research observations',
  )
  await expect(
    page.getByRole('button', { name: /^Inspect cluster / }).first(),
  ).toBeVisible()
  await page.getByRole('button', { name: 'BGC', exact: true }).click()
  const first = page
    .getByRole('button', { name: /^Research details for / })
    .first()
  await expect(first).toBeVisible()
  await first.click()
  const details = page.getByTestId('ncr-selected-details')
  await expect(details).toContainText('This is not an available parking offer.')
  await expect(details).toContainText('No physical verification')
  await expect(details).toContainText('Fees: unknown')
  await expect(details).toContainText('Availability: unknown')
  await expect(details).toContainText('not a confirmed driving entrance')
  await expect(details).toContainText('not approved')
  await expect(page.getByTestId('parking-get-directions')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Close research details', exact: true })
    .click()
  await page.getByRole('button', { name: 'Entrances', exact: true }).click()
  const entrance = page
    .getByRole('button', { name: /^Research details for / })
    .first()
  await expect(entrance).toContainText('entrance')
  await entrance.click()
  await expect(page.getByTestId('ncr-selected-details')).toContainText(
    'Driving navigation is unavailable',
  )
  await page
    .getByRole('button', { name: 'Approved projection', exact: true })
    .click()
  await expect(page.getByTestId('ncr-empty')).toContainText(
    'No NCR records are approved',
  )
  await page
    .getByRole('link', {
      name: 'Return to Poblacion pilot and offline fallback',
    })
    .click()
  await expect(page.getByTestId('destination-query')).toBeVisible()
})
