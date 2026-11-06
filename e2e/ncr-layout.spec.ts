import { test, expect } from './fixtures'

// Includes cold Expo route compilation and the complete 11-page snapshot.
test.setTimeout(120_000)

// Playwright normally hides scrollbars, concealing the 15px width oscillation
// seen when real desktop browsers alternate between empty and populated lists.
test.use({
  launchOptions: {
    args: ['--enable-unsafe-swiftshader'],
    ignoreDefaultArgs: ['--hide-scrollbars'],
  },
})

test('full-screen NCR map stays mounted and stable with visible scrollbars', async ({
  page,
}) => {
  await page.goto('/ncr-research')
  const map = page.getByTestId('ncr-map-ready')
  await expect(map).toBeVisible({ timeout: 30000 })
  await expect(page.getByTestId('ncr-empty')).toBeVisible()
  const bounds = await map.boundingBox()
  const viewport = page.viewportSize()
  expect(bounds?.height).toBe(viewport?.height)
  expect(bounds?.width).toBe(viewport?.width)
  const originalMap = await map.elementHandle()
  if (!originalMap) throw new Error('Expected the mounted research map')

  await page
    .getByRole('button', { name: 'Open private research', exact: true })
    .click()
  await expect(page.getByTestId('ncr-result-summary')).toContainText(
    '5,427 research records loaded',
    { timeout: 30000 },
  )
  const samples = await page.evaluate(async (element) => {
    const observations = []
    for (let frame = 0; frame < 120; frame++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
      const current = document.querySelector('[data-testid="ncr-map-ready"]')
      observations.push({
        width: current?.getBoundingClientRect().width,
        sameMap: current === element,
        hasResults: Boolean(
          document.querySelector('[data-testid="ncr-result-summary"]'),
        ),
      })
    }
    return observations
  }, originalMap)
  expect(samples.every((sample) => sample.sameMap && sample.hasResults)).toBe(
    true,
  )
  const widths = samples.map((sample) => sample.width)
  expect(new Set(widths).size).toBe(1)

  await page
    .getByRole('button', { name: 'Approved projection', exact: true })
    .click()
  await expect(page.getByTestId('ncr-empty')).toContainText(
    'No NCR records are approved',
  )
  expect((await map.boundingBox())?.width).toBe(widths[0])
})
