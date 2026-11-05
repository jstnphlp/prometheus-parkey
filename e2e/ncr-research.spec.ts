import { test, expect } from './fixtures'

const ncrApi = `http://127.0.0.1:${process.env.PARKEY_E2E_NCR_PORT || '8090'}`

// Keep bounded assertions; allow cold compilation plus complete-snapshot loading.
test.setTimeout(120_000)

test('full-screen NCR map loads the complete private snapshot once and clears it in public mode', async ({
  page,
}) => {
  const fonts = new Set<string>(),
    requests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/fonts/'))
      fonts.add(decodeURIComponent(url.pathname.split('/')[2] || ''))
    if (url.pathname.startsWith('/api/ncr/')) requests.push(request.url())
  })
  const published = await page.request.get(
    `${ncrApi}/api/ncr/discovery?bbox=120.85,14.3,121.27,14.86&zoom=20`,
  )
  expect(published.ok()).toBe(true)
  expect(await published.json()).toMatchObject({
    mode: 'public',
    items: [],
    totalMatched: 0,
  })
  await page.goto('/ncr-research')
  const map = page.getByTestId('ncr-map-ready'),
    summary = page.getByTestId('ncr-result-summary')
  await expect(map).toBeVisible({ timeout: 30000 })
  await expect(page.getByTestId('ncr-empty')).toContainText(
    'No NCR records are approved',
  )
  await page
    .getByRole('button', { name: 'Open private research', exact: true })
    .click()
  await expect(summary).toContainText('5,427 research records loaded', {
    timeout: 30000,
  })
  // The development preview initially shows source-named parking or nearby
  // destination context, with the unmodified full archive one filter away.
  await page.getByRole('button', { name: 'All features', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Named or near destinations (research)' }),
  ).toHaveAttribute('aria-selected', 'true')
  await page
    .getByRole('button', { name: 'All research (including unnamed)' })
    .click()
  await expect(summary).toContainText('5,427 shown')
  expect(
    requests.filter((url) => url.includes('/research-preview?')),
  ).toHaveLength(11)
  await expect.poll(() => [...fonts]).toContain('Noto Sans Bold')
  expect([...fonts]).not.toContain('Open Sans Regular,Arial Unicode MS Regular')
  const loadedRequestCount = requests.length
  await page.getByRole('button', { name: 'Jump to area', exact: true }).click()
  await page.getByRole('button', { name: 'BGC', exact: true }).click()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  const box = await map.boundingBox()
  if (!box) throw new Error('Expected full-screen map bounds')
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.55)
  await page.mouse.down()
  await page.mouse.move(
    box.x + box.width * 0.65 + 35,
    box.y + box.height * 0.55 + 20,
    { steps: 8 },
  )
  await page.mouse.up()
  await page.getByRole('button', { name: 'Locations', exact: true }).click()
  await page
    .getByRole('button', { name: /^Research details for / })
    .first()
    .click()
  const details = page.getByTestId('ncr-selected-details')
  for (const fact of [
    'This is not an available parking offer.',
    'No physical verification',
    'Fees: unknown',
    'Availability: unknown',
    'not a confirmed driving entrance',
    'not approved',
  ])
    await expect(details).toContainText(fact)
  await expect(page.getByTestId('parking-get-directions')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Close Research details', exact: true })
    .click()
  await page.getByRole('button', { name: 'All features', exact: true }).click()
  await page.getByRole('button', { name: 'Entrances', exact: true }).click()
  await expect(summary).toContainText('988 shown')
  await page.getByRole('button', { name: 'Locations', exact: true }).click()
  const entrance = page
    .getByRole('button', { name: /^Research details for / })
    .first()
  await expect(entrance).toContainText('entrance')
  await entrance.click()
  await expect(details).toContainText('Driving navigation is unavailable')
  await page
    .getByRole('button', { name: 'Close Research details', exact: true })
    .click()
  expect(requests).toHaveLength(loadedRequestCount)
  await page
    .getByRole('button', { name: 'Approved projection', exact: true })
    .click()
  await expect(page.getByTestId('ncr-empty')).toContainText(
    'No NCR records are approved',
  )
  await expect(details).toHaveCount(0)
  await expect(summary).toContainText('0 approved records loaded')
  const publicRequestCount = requests.length
  await page
    .getByRole('button', { name: 'Open private research', exact: true })
    .click()
  await expect(summary).toContainText('5,427 research records loaded')
  expect(requests).toHaveLength(publicRequestCount)
  await page
    .getByRole('link', {
      name: 'Return to Poblacion pilot and offline fallback',
    })
    .click()
  await expect(page.getByTestId('destination-query')).toBeVisible()
})

test('an interrupted complete load shows no partial research and retry recovers', async ({
  page,
}) => {
  const endpoint = `${ncrApi}/api/ncr/research-preview**`
  await page.route(endpoint, (route) =>
    new URL(route.request().url()).searchParams.has('cursor')
      ? route.fulfill({ status: 503, body: 'Synthetic interrupted page' })
      : route.continue(),
  )
  await page.goto('/ncr-research')
  await expect(page.getByTestId('ncr-empty')).toBeVisible({ timeout: 30000 })
  await page
    .getByRole('button', { name: 'Open private research', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('503', { timeout: 30000 })
  await expect(page.getByTestId('ncr-result-summary')).not.toContainText(
    'research records loaded',
  )
  await expect(
    page.getByRole('button', { name: 'Locations', exact: true }),
  ).toBeDisabled()
  await page.unroute(endpoint)
  await page
    .getByRole('button', { name: 'Retry / refresh', exact: true })
    .click()
  await expect(page.getByTestId('ncr-result-summary')).toContainText(
    '5,427 research records loaded',
    { timeout: 30000 },
  )
  await page
    .getByRole('button', { name: 'Approved projection', exact: true })
    .click()
  await expect(page.getByTestId('ncr-empty')).toContainText(
    'No NCR records are approved',
  )
})

test('private facility details show source-only name evidence and clear it in public mode', async ({
  page,
}) => {
  await page.goto('/ncr-research')
  await expect(page.getByTestId('ncr-empty')).toBeVisible({ timeout: 30000 })
  await page
    .getByRole('button', { name: 'Open private research', exact: true })
    .click()
  await expect(page.getByTestId('ncr-result-summary')).toContainText(
    '5,427 research records loaded',
    { timeout: 30000 },
  )
  await page.getByRole('button', { name: 'All features', exact: true }).click()
  await page.getByRole('button', { name: 'Lots', exact: true }).click()
  await page.getByRole('button', { name: 'Lots', exact: true }).click()
  await page
    .getByRole('button', { name: 'All research (including unnamed)' })
    .click()
  await page.getByRole('button', { name: 'Locations', exact: true }).click()
  const lot = page
    .getByRole('button', { name: /^Research details for / })
    .first()
  await expect(lot).toContainText('lot')
  const originalName = (await lot.getAttribute('aria-label'))?.replace(
    /^Research details for /,
    '',
  )
  if (!originalName)
    throw new Error('Expected retained source name in location label')
  await lot.click()
  const details = page.getByTestId('ncr-selected-details')
  await expect(
    details.getByRole('heading', { name: originalName, exact: true }),
  ).toBeVisible()
  await expect(details).toContainText('Parking-name review')
  await expect(details).toContainText('Parkey group: facility:')
  await expect(details).toContainText('Proposed parking name:')
  await expect(details).toContainText('Source-review information only.')
  await expect(details).toContainText('The original map label is retained.')
  await expect(details).toContainText(
    'No visit, visitor access or publication is approved.',
  )
  await expect(details).toContainText('Driving navigation is unavailable')
  await expect(page.getByTestId('parking-get-directions')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Close Research details', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Approved projection', exact: true })
    .click()
  await expect(page.getByTestId('ncr-empty')).toContainText(
    'No NCR records are approved',
  )
  await expect(details).toHaveCount(0)
  await expect(
    page.getByText('Parking-name review', { exact: true }),
  ).toHaveCount(0)
  await expect(page.getByTestId('ncr-result-summary')).toContainText(
    '0 approved records loaded',
  )
})
