import { test, expect, openSpot } from './fixtures'

test('unverified source parking cannot request directions or open an external driving route', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/route/v1/driving/'))
      requests.push(request.url())
  })
  await openSpot(page)
  await expect(page.getByTestId('parking-get-directions')).toBeDisabled()
  await expect(page.getByTestId('parking-navigation-warning')).toContainText(
    'operator authorization',
  )
  await expect(page.getByTestId('route-panel')).toHaveCount(0)
  await expect(
    page.getByRole('alertdialog', { name: 'Directions privacy' }),
  ).toHaveCount(0)
  expect(requests).toHaveLength(0)
})
