import { mkdir, writeFile } from 'node:fs/promises'

import { test, expect, openMap } from './fixtures'

test.use({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1 })
const evidence = 'docs/evidence/figma-exact/browser'

for (const mode of ['light-magenta', 'dark-magenta'] as const) {
  test.describe(mode, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(
        (value) => localStorage.setItem('parkey.appearance.v1', value),
        mode,
      )
      await mkdir(evidence, { recursive: true })
    })

    test(`${mode}: real startup splash while local state hydrates`, async ({
      page,
      context,
    }) => {
      await page.addInitScript(() => {
        const original = Storage.prototype.getItem
        Object.defineProperty(Storage.prototype, 'getItem', {
          configurable: true,
          value: function (this: Storage, key: string) {
            if (key !== 'parkey:onboarding:v1') return original.call(this, key)
            return new Promise<string | null>((resolve) =>
              window.addEventListener(
                'parkey-release-startup',
                () => resolve(original.call(this, key)),
                { once: true },
              ),
            )
          },
        })
      })
      try {
        await page.goto('/', { waitUntil: 'domcontentloaded' })
        await expect(page.getByAltText('Parkey', { exact: true })).toBeVisible()
        await expect(page.locator('html')).toHaveCSS(
          'color-scheme',
          mode === 'dark-magenta' ? 'dark' : 'light',
        )
        await page.waitForFunction(() =>
          [...document.images].some(
            (image) => image.complete && image.naturalWidth >= 176,
          ),
        )
        const cdp = await context.newCDPSession(page)
        const screenshot = await cdp.send('Page.captureScreenshot', {
          format: 'png',
        })
        await writeFile(
          `${evidence}/${mode}-1.png`,
          Buffer.from(screenshot.data, 'base64'),
        )
        await cdp.detach()
      } finally {
        await page.evaluate(() =>
          window.dispatchEvent(new Event('parkey-release-startup')),
        )
      }
      await expect(page.getByTestId('discovery-map-ready')).toBeVisible()
    })

    test(`${mode}: location denial retains manual destination search`, async ({
      page,
      context,
    }) => {
      await context.clearPermissions()
      await page.addInitScript(() => {
        navigator.geolocation.getCurrentPosition = (_success, error) =>
          error?.({
            code: 1,
            message: 'Synthetic permission denial',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          })
      })
      await openMap(page)
      await page
        .getByRole('button', { name: 'Center on my location', exact: true })
        .click()
      await expect(
        page.getByRole('heading', { name: /Find parking/ }),
      ).toBeVisible()
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((image) =>
            image.decode().catch(() => undefined),
          ),
        )
      })
      await page.screenshot({
        path: `${evidence}/${mode}-20.png`,
        scale: 'css',
      })
      await page
        .getByRole('button', { name: 'Use Current Location', exact: true })
        .click()
      await expect(
        page.getByRole('heading', { name: /Location access/ }),
      ).toBeVisible()
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((image) =>
            image.decode().catch(() => undefined),
          ),
        )
      })
      await page.screenshot({
        path: `${evidence}/${mode}-20A.png`,
        scale: 'css',
      })
      await page
        .getByRole('button', { name: 'Search a Destination', exact: true })
        .click()
      await page.getByTestId('destination-query').fill('Poblacion')
      await expect(page.getByTestId('destination-result-0')).toContainText(
        'Poblacion Test Cafe',
      )
    })

    test(`${mode}: completed empty query and empty saved collection recover to guest exploration`, async ({
      page,
    }) => {
      await page.route('**/rest/v1/rpc/discover_parking', (route) =>
        route.fulfill({ json: { records: [], truncated: false } }),
      )
      await openMap(page)
      await page
        .getByRole('button', { name: 'Filter parking', exact: true })
        .click()
      await page
        .getByRole('checkbox', { name: 'Covered parking', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Apply Filters', exact: true })
        .click()
      await expect(
        page.getByRole('heading', { name: 'No parking found', exact: true }),
      ).toBeVisible()
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((image) =>
            image.decode().catch(() => undefined),
          ),
        )
      })
      await page.screenshot({
        path: `${evidence}/${mode}-22C.png`,
        scale: 'css',
      })
      await page
        .getByRole('button', { name: 'Clear Filters', exact: true })
        .click()
      await expect(page).not.toHaveURL(/features=/)
      await page.getByRole('tab', { name: 'Saved', exact: true }).click()
      await expect(
        page.getByRole('heading', { name: 'Nothing saved yet', exact: true }),
      ).toBeVisible()
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((image) =>
            image.decode().catch(() => undefined),
          ),
        )
      })
      await page.screenshot({
        path: `${evidence}/${mode}-26A.png`,
        scale: 'css',
      })
      await page
        .getByRole('button', { name: 'Explore Parking', exact: true })
        .click()
      await expect(
        page.getByRole('button', {
          name: 'Search parking or landmark',
          exact: true,
        }),
      ).toBeVisible()
    })

    test(`${mode}: account gates, settings, local help search and recovery form`, async ({
      page,
    }) => {
      await page.goto('/account')
      await expect(
        page.getByRole('heading', { name: /get you parked/ }),
      ).toBeVisible()
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((image) =>
            image.decode().catch(() => undefined),
          ),
        )
      })
      await page.screenshot({ path: `${evidence}/${mode}-5.png`, scale: 'css' })
      for (const [path, title, id] of [
        ['/register', 'Create an Account', '6'],
        ['/forgot-password', /Forgot your/, '18'],
      ] as const) {
        await page.goto(path)
        await expect(page.getByRole('heading', { name: title })).toBeVisible()
        const message = page.getByRole('button', {
          name: 'Close message',
          exact: true,
        })
        if (await message.isVisible()) await message.click()
        await page.evaluate(async () => {
          await Promise.all(
            [...document.images].map((image) =>
              image.decode().catch(() => undefined),
            ),
          )
        })
        await page.screenshot({
          path: `${evidence}/${mode}-${id}.png`,
          scale: 'css',
        })
      }
      for (const [path, title, id] of [
        ['/settings/language', 'Language', '79'],
        ['/settings/help', 'Help Center', '80'],
        ['/settings/privacy', 'Privacy & Data', '83'],
        ['/settings/about', 'About Parkey', '84'],
      ] as const) {
        await page.goto(path)
        await expect(
          page.getByRole('heading', { name: title, exact: true }),
        ).toBeVisible()
        await page.evaluate(async () => {
          await Promise.all(
            [...document.images].map((image) =>
              image.decode().catch(() => undefined),
            ),
          )
        })
        await page.screenshot({
          path: `${evidence}/${mode}-${id}.png`,
          scale: 'css',
        })
        if (id === '80') {
          await page
            .getByRole('textbox', { name: 'Search help topics', exact: true })
            .fill('account')
          await page
            .getByRole('button', { name: 'Do I need an account?', exact: true })
            .click()
          await expect(
            page.getByText(
              'No. Explore, search, saved parking and directions are available without registration.',
              { exact: true },
            ),
          ).toBeVisible()
        }
      }
    })
  })
}
