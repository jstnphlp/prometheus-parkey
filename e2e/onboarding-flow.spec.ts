import { test, expect, openMap } from './fixtures'

for (const mode of ['light-magenta', 'dark-magenta'] as const) {
  test(`${mode}: walkthrough finishes at login and guest exploration remains explicit`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('parkey.appearance.v1', value),
      mode,
    )
    await page.goto('/welcome')
    await page.getByRole('button', { name: 'Get Started', exact: true }).click()
    for (const [index, label] of ['Next', 'Next', 'Continue'].entries()) {
      await expect(
        page.getByRole('heading', {
          name: new RegExp(`Step ${index + 1} of 3`),
        }),
      ).toBeVisible()
      await page.getByRole('button', { name: label, exact: true }).click()
    }
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByTestId('discovery-map-ready')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Close message', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Close message', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: /Sign in to your.*account/ }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Explore as guest', exact: true })
      .click()
    await expect(page.getByTestId('discovery-map-ready')).toBeVisible()
    expect(
      await page.evaluate(() => localStorage.getItem('parkey:onboarding:v1')),
    ).toBe('complete')
  })
}

test('Skip bypasses the walkthrough, then opens login', async ({ page }) => {
  await page.goto('/onboarding/discover')
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByTestId('discovery-map-ready')).toHaveCount(0)
})

test('setup cannot be opened without real sign-in or by a URL completion flag', async ({
  page,
}) => {
  await page.goto('/account-setup?complete=true')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByTestId('account-setup-page')).toHaveCount(0)
  await openMap(page)
  await expect(page.getByTestId('discovery-map-ready')).toBeVisible()
})
