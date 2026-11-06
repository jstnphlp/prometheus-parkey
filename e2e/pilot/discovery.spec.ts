import {
  test,
  expect,
  openPilot,
  openResults,
  closeDetails,
  envelope,
  parking,
  reviewerToken,
} from './fixtures'

test('main pilot map scopes results and clears details when changing city', async ({
  page,
}) => {
  await openPilot(page)
  await openResults(page)
  await expect(page.getByTestId('pilot-record-qa-Manila')).toBeVisible()
  await page.getByTestId('pilot-record-qa-Manila').click()
  await expect(page.getByTestId('pilot-details')).toContainText(
    'Parking near Manila Test Museum',
  )
  await expect(page.getByTestId('pilot-details')).toContainText(/unknown/i)
  await expect(page.getByTestId('pilot-directions')).toBeDisabled()
  await closeDetails(page)
  await page.getByTestId('pilot-city-Mandaluyong').click()
  await openResults(page)
  await expect(page.getByTestId('pilot-record-qa-Mandaluyong')).toBeVisible()
  await expect(page.getByTestId('pilot-record-qa-Manila')).toHaveCount(0)
  await expect(page.getByTestId('pilot-details')).toHaveCount(0)
})

test('destination search focuses the active city without granting parking navigation', async ({
  page,
}) => {
  await openPilot(page)
  await page.getByTestId('pilot-search-open').click()
  await page.getByTestId('pilot-destination-search').fill('Museum')
  await page.getByTestId('pilot-destination-destination-Manila').click()
  await openResults(page)
  await expect(page.getByTestId('pilot-record-qa-Manila')).toBeVisible()
  await page.getByTestId('pilot-record-qa-Manila').click()
  await expect(page.getByTestId('pilot-directions')).toBeDisabled()
  await expect(page.getByTestId('pilot-details')).toContainText('ODbL-1.0')
})

test('candidate session is explicit, memory only and cleared before public results', async ({
  page,
}) => {
  await openPilot(page)
  await page.getByTestId('pilot-mode-candidate').click()
  await expect(page.getByTestId('pilot-record-qa-Manila')).toHaveCount(0)
  await page.getByTestId('pilot-reviewer-token').fill(reviewerToken)
  await page.getByTestId('pilot-reviewer-connect').click()
  await expect(page.getByTestId('pilot-candidate-warning')).toBeVisible()
  await openResults(page)
  await expect(
    page.getByTestId('pilot-record-qa-candidate-Manila'),
  ).toBeVisible()
  await page.getByTestId('pilot-record-qa-candidate-Manila').click()
  await expect(page.getByTestId('pilot-directions')).toBeDisabled()
  const stored = await page.evaluate(() =>
    Object.values(localStorage).join(' '),
  )
  expect(stored).not.toContain(reviewerToken)
  await closeDetails(page)
  await page.getByTestId('pilot-mode-public').click()
  await expect(page.getByTestId('pilot-candidate-warning')).toHaveCount(0)
  await expect(page.getByTestId('pilot-details')).toHaveCount(0)
  await openResults(page)
  await expect(page.getByTestId('pilot-record-qa-Manila')).toBeVisible()
  await expect(
    page.getByTestId('pilot-record-qa-candidate-Manila'),
  ).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('pilot-reviewer-disconnect')).toHaveCount(0)
})

test('server rejection cannot expose candidate records', async ({ page }) => {
  await openPilot(page)
  await page.getByTestId('pilot-mode-candidate').click()
  await page
    .getByTestId('pilot-reviewer-token')
    .fill('synthetic.invalid.signature')
  await page.getByTestId('pilot-reviewer-connect').click()
  await expect(
    page.getByText(/Reviewer access was refused or expired/),
  ).toBeVisible()
  await expect(page.getByTestId('pilot-candidate-warning')).toHaveCount(0)
  await expect(page.getByTestId('pilot-record-qa-Manila')).toHaveCount(0)
})

test('empty public results offer recovery without substituting private observations', async ({
  page,
}) => {
  await page.route('**/rest/v1/rpc/discover_pilot_parking', async (route) => {
    await route.fulfill({
      json: envelope('pilot_discovery', 'Manila', 'public', []),
    })
  })
  await openPilot(page)
  await expect(page.getByTestId('pilot-empty')).toBeVisible()
  await expect(page.getByTestId('pilot-refresh')).toBeVisible()
  await expect(page.getByTestId('pilot-record-qa-Manila')).toHaveCount(0)
  await expect(page.getByTestId('pilot-empty')).toContainText(
    /approved|review|result/i,
  )
})

test('network failure presents retry and recovery', async ({ page }) => {
  let interrupted = true
  await page.route('**/rest/v1/rpc/discover_pilot_parking', async (route) => {
    if (interrupted) await route.abort('connectionfailed')
    else await route.fallback()
  })
  await openPilot(page)
  await expect(page.getByTestId('pilot-error')).toBeVisible()
  interrupted = false
  await page.getByTestId('pilot-refresh').click()
  await openResults(page)
  await expect(page.getByTestId('pilot-record-qa-Manila')).toBeVisible()
})

test('expired publication data fails closed at the mobile API boundary', async ({
  page,
}) => {
  await page.route('**/rest/v1/rpc/discover_pilot_parking', async (route) => {
    const record = parking('Manila', 'public')
    record.reviewDueAt = '2020-01-01T00:00:00Z'
    await route.fulfill({
      json: envelope('pilot_discovery', 'Manila', 'public', [record]),
    })
  })
  await openPilot(page)
  await expect(page.getByTestId('pilot-error')).toBeVisible()
  await expect(page.getByTestId('pilot-record-qa-Manila')).toHaveCount(0)
})

test('a late response from the previous city cannot replace the active scope', async ({
  page,
}) => {
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/rest/v1/rpc/discover_pilot_parking', async (route) => {
    const body: unknown = route.request().postDataJSON()
    if (
      typeof body === 'object' &&
      body !== null &&
      'p_city' in body &&
      body.p_city === 'Manila'
    ) {
      await held
      await route
        .fulfill({
          json: envelope('pilot_discovery', 'Manila', 'public', [
            parking('Manila', 'public'),
          ]),
        })
        .catch(() => {})
    } else await route.fallback()
  })
  await openPilot(page)
  await page.getByTestId('pilot-city-Mandaluyong').click()
  await openResults(page)
  await expect(page.getByTestId('pilot-record-qa-Mandaluyong')).toBeVisible()
  release()
  await expect(page.getByTestId('pilot-record-qa-Manila')).toHaveCount(0)
})

test('navigation rechecks approval and uses the reviewed entrance coordinate', async ({
  page,
}) => {
  const record = parking('Manila', 'public')
  record.navigationApproval = {
    entrance: [120.9756, 14.5911],
    entranceConfirmed: true,
    visitorAccessConfirmed: true,
    operatorAuthorized: true,
    expiresAt: record.reviewDueAt || '',
  }
  let rechecks = 0
  await page.addInitScript(() => {
    window.open = (url) => {
      localStorage.setItem('synthetic-navigation-url', String(url))
      return null
    }
  })
  await page.route('**/rest/v1/rpc/*pilot_parking', async (route) => {
    if (route.request().url().endsWith('/get_pilot_parking')) rechecks++
    await route.fulfill({
      json: envelope('pilot_discovery', 'Manila', 'public', [record]),
    })
  })
  await openPilot(page)
  await openResults(page)
  await page.getByTestId('pilot-record-qa-Manila').click()
  await expect(page.getByTestId('pilot-directions')).toBeEnabled()
  await page.getByTestId('pilot-directions').click()
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('synthetic-navigation-url')),
    )
    .toContain('destination=14.5911%2C120.9756')
  expect(rechecks).toBe(1)
})

test('revoked entrance permission prevents external navigation', async ({
  page,
}) => {
  const record = parking('Manila', 'public')
  record.navigationApproval = {
    entrance: [120.9756, 14.5911],
    entranceConfirmed: true,
    visitorAccessConfirmed: true,
    operatorAuthorized: true,
    expiresAt: record.reviewDueAt || '',
  }
  let revoked = false
  await page.addInitScript(() => {
    window.open = (url) => {
      localStorage.setItem('synthetic-navigation-url', String(url))
      return null
    }
  })
  await page.route('**/rest/v1/rpc/*pilot_parking', async (route) => {
    if (route.request().url().endsWith('/get_pilot_parking')) revoked = true
    await route.fulfill({
      json: envelope(
        'pilot_discovery',
        'Manila',
        'public',
        revoked ? [] : [record],
      ),
    })
  })
  await openPilot(page)
  await openResults(page)
  await page.getByTestId('pilot-record-qa-Manila').click()
  await expect(page.getByTestId('pilot-directions')).toBeEnabled()
  await page.getByTestId('pilot-directions').click()
  await expect(page.getByTestId('pilot-details')).toHaveCount(0)
  expect(revoked).toBe(true)
  expect(
    await page.evaluate(() => localStorage.getItem('synthetic-navigation-url')),
  ).toBeNull()
})
