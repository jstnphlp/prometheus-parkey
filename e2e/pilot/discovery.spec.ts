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

test('Map Saved and You share discovery navigation and public favorites survive reload', async ({
  page,
}) => {
  await openPilot(page)
  await openResults(page)
  await page.getByTestId('pilot-record-qa-Manila').click()
  await page.getByTestId('pilot-favorite').click()
  await expect(page.getByTestId('pilot-favorite')).toHaveText(
    'Remove saved parking',
  )
  await closeDetails(page)
  await page.getByRole('tab', { name: 'Saved', exact: true }).click()
  const savedArea = page.getByRole('button', {
    name: 'Parking near Manila Test Museum · Manila · Show saved area',
    exact: true,
  })
  await expect(savedArea).toBeVisible()
  await expect(
    page.getByText(/Saved parking labels are reminders/),
  ).toBeVisible()
  await page.reload()
  await page.getByRole('tab', { name: 'Saved', exact: true }).click()
  await expect(savedArea).toBeVisible()
  await savedArea.click()
  await expect(page.getByTestId('pilot-details')).toHaveCount(0)
  await openResults(page)
  await page.getByTestId('pilot-record-qa-Manila').click()
  await expect(page.getByTestId('pilot-directions')).toBeDisabled()
  await closeDetails(page)
  await page.getByRole('tab', { name: 'You', exact: true }).click()
  await expect(page.getByText('Map information', { exact: true })).toBeVisible()
  await expect(page.getByText(/Analytics collection is disabled/)).toBeVisible()
})

test('destination ranking and price filters preserve unknown fees and original types', async ({
  page,
}) => {
  const near = {
    ...parking('Manila', 'public'),
    id: 'near-free',
    sourceObservationId: 'distinct-near-source',
    fees: 'No fee',
  }
  const paid = {
    ...parking('Manila', 'public'),
    id: 'far-paid',
    sourceObservationId: 'distinct-paid-source',
    source: {
      ...parking('Manila', 'public').source,
      url: 'https://www.openstreetmap.org/node/3',
    },
    fees: 'PHP 40/hr',
    representativePoint: [120.9765, 14.591] as [number, number],
    geometry: {
      type: 'Point' as const,
      coordinates: [120.9765, 14.591] as [number, number],
    },
  }
  const unknown = {
    ...parking('Manila', 'public'),
    id: 'unknown-fee',
    sourceObservationId: 'distinct-unknown-source',
    source: {
      ...parking('Manila', 'public').source,
      url: 'https://www.openstreetmap.org/node/4',
    },
    featureType: 'facility_unspecified' as const,
    representativePoint: [120.9795, 14.591] as [number, number],
    geometry: {
      type: 'Point' as const,
      coordinates: [120.9795, 14.591] as [number, number],
    },
  }
  await page.route('**/rest/v1/rpc/discover_pilot_parking', (route) =>
    route.fulfill({
      json: envelope('pilot_discovery', 'Manila', 'public', [
        unknown,
        paid,
        near,
      ]),
    }),
  )
  await openPilot(page)
  await page.getByTestId('pilot-search-open').click()
  await page.getByTestId('pilot-destination-search').fill('Museum')
  await page.getByTestId('pilot-destination-destination-Manila').click()
  await openResults(page)
  const rows = page.locator('[data-testid^="pilot-record-"]')
  await expect(rows).toHaveCount(3)
  await expect(rows.first()).toHaveAttribute(
    'data-testid',
    'pilot-record-near-free',
  )
  await expect(
    page.getByText(
      'Straight-line distance to Manila Test Museum. This is not a walking route.',
      { exact: true },
    ),
  ).toBeVisible()
  await page.getByTestId('pilot-fees-paid').click()
  await expect(rows).toHaveCount(1)
  await expect(page.getByTestId('pilot-record-far-paid')).toBeVisible()
  await expect(
    page.getByText(
      '1 loaded records have unknown fees and are excluded by this filter.',
      { exact: true },
    ),
  ).toBeVisible()
  await page.getByTestId('pilot-fees-free').click()
  await expect(rows).toHaveCount(1)
  await expect(page.getByTestId('pilot-record-near-free')).toBeVisible()
  await page.getByTestId('pilot-fees-all').click()
  await page.getByRole('button', { name: 'Unclassified', exact: true }).click()
  await expect(rows).toHaveCount(1)
  await expect(page.getByTestId('pilot-record-unknown-fee')).toContainText(
    'Unclassified parking',
  )
})

test('destination failures retry inside the search panel without changing city or query', async ({
  page,
}) => {
  let attempts = 0
  await page.route(
    '**/rest/v1/rpc/discover_pilot_destinations',
    async (route) => {
      attempts++
      if (attempts === 1) await route.abort('failed')
      else await route.fallback()
    },
  )
  await openPilot(page)
  await page.getByTestId('pilot-search-open').click()
  await expect(page.getByTestId('pilot-search-retry')).toBeVisible()
  await page.getByTestId('pilot-search-retry').click()
  await expect(
    page.getByTestId('pilot-destination-destination-Manila'),
  ).toBeVisible()
  await expect(page.getByTestId('pilot-destination-search')).toHaveValue('')
  expect(attempts).toBeGreaterThanOrEqual(2)
})

test('damaged parked-car storage offers recovery without losing public favorites', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('parkey.discovery.saved-parking.v1', 'not-json'),
  )
  await openPilot(page)
  await page.getByRole('tab', { name: 'Saved', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Retry parked location', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Save where I parked', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('button', {
      name: 'Clear saved car and previous saved places',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('button', { name: 'Save where I parked', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByText(
      'No saved parking yet. Save an approved parking record from its details.',
      { exact: true },
    ),
  ).toBeVisible()
})

test('public viewport cache survives a failed refresh without retaining navigation authority', async ({
  page,
}) => {
  const approved = {
    ...parking('Manila', 'public'),
    navigationApproval: {
      entrance: [120.9755, 14.591] as [number, number],
      entranceConfirmed: true,
      visitorAccessConfirmed: true,
      operatorAuthorized: true,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  }
  await page.route('**/rest/v1/rpc/discover_pilot_parking', (route) =>
    route.fulfill({
      json: envelope('pilot_discovery', 'Manila', 'public', [approved]),
    }),
  )
  await openPilot(page)
  await openResults(page)
  await expect(page.getByTestId('pilot-record-qa-Manila')).toBeVisible()
  await page
    .getByRole('button', { name: 'Close Manila parking in view', exact: true })
    .click()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.keys(localStorage).filter((key) =>
            key.startsWith('parkey.discovery.public-pilot-cache.v1:'),
          ).length,
      ),
    )
    .toBeGreaterThan(0)
  const stored = await page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([key]) =>
        key.startsWith('parkey.discovery.public-pilot-cache.v1:'),
      )
      .map(([, value]) => value)
      .join(''),
  )
  expect(stored).not.toContain('entranceConfirmed')
  expect(stored).not.toContain('operatorAuthorized')
  await page.route('**/rest/v1/rpc/discover_pilot_parking', (route) =>
    route.abort('failed'),
  )
  await page.getByTestId('pilot-refresh').click()
  await expect(page.getByTestId('pilot-cache-notice')).toContainText(
    'saved public copy',
  )
  await openResults(page)
  await page.getByTestId('pilot-record-qa-Manila').click()
  await expect(page.getByTestId('pilot-directions')).toBeDisabled()
  await expect(
    page.getByText(/Saved public copies never authorize navigation/),
  ).toBeVisible()
})

test('public authorization refusal invalidates cached copies instead of reviving them', async ({
  page,
}) => {
  await openPilot(page)
  await openResults(page)
  await expect(page.getByTestId('pilot-record-qa-Manila')).toBeVisible()
  await page
    .getByRole('button', { name: 'Close Manila parking in view', exact: true })
    .click()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.keys(localStorage).filter((key) =>
            key.startsWith('parkey.discovery.public-pilot-cache.v1:'),
          ).length,
      ),
    )
    .toBeGreaterThan(0)
  await page.route('**/rest/v1/rpc/discover_pilot_parking', (route) =>
    route.fulfill({
      status: 403,
      json: { message: 'Synthetic public access revoked' },
    }),
  )
  await page.getByTestId('pilot-refresh').click()
  await expect(page.getByTestId('pilot-error')).toContainText(
    /refused|expired/i,
  )
  await expect(page.getByTestId('pilot-cache-notice')).toHaveCount(0)
  await openResults(page)
  await expect(page.getByTestId('pilot-record-qa-Manila')).toHaveCount(0)
})

test('going offline closes private research and never writes candidate bodies to public cache', async ({
  page,
  context,
}) => {
  await openPilot(page)
  await page.getByTestId('pilot-mode-candidate').click()
  await page.getByTestId('pilot-reviewer-token').fill(reviewerToken)
  await page.getByTestId('pilot-reviewer-connect').click()
  await openResults(page)
  await expect(
    page.getByTestId('pilot-record-qa-candidate-Manila'),
  ).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByTestId('pilot-candidate-warning')).toHaveCount(0)
  await expect(
    page.getByTestId('pilot-record-qa-candidate-Manila'),
  ).toHaveCount(0)
  await expect(
    page.getByText(/research session was closed while offline/),
  ).toBeVisible()
  const stored = await page.evaluate(() => Object.values(localStorage).join(''))
  expect(stored).not.toContain('qa-candidate-Manila')
  expect(stored).not.toContain(reviewerToken)
  await context.setOffline(false)
})

test('authorization refusal on a later page clears prior public records and cache', async ({
  page,
}) => {
  await page.route('**/rest/v1/rpc/discover_pilot_parking', async (route) => {
    const body = route.request().postDataJSON()
    if (body.p_after)
      await route.fulfill({
        status: 403,
        json: { message: 'Synthetic paginated access revoked' },
      })
    else
      await route.fulfill({
        json: {
          ...envelope('pilot_discovery', 'Manila', 'public', [
            parking('Manila', 'public'),
          ]),
          nextCursor: 'synthetic-next-cursor',
        },
      })
  })
  await openPilot(page)
  await openResults(page)
  await expect(page.getByTestId('pilot-record-qa-Manila')).toBeVisible()
  await page.getByTestId('pilot-load-more').click()
  await expect(page.getByTestId('pilot-record-qa-Manila')).toHaveCount(0)
  await expect(
    page.getByText(/Reviewer access was refused or expired/).first(),
  ).toBeVisible()
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
  await expect(page.getByTestId('pilot-favorite')).toHaveCount(0)
  const stored = await page.evaluate(() =>
    Object.values(localStorage).join(' '),
  )
  expect(stored).not.toContain(reviewerToken)
  expect(stored).not.toContain('qa-candidate-Manila')
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
