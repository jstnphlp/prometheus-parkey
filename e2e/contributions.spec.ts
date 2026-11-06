import { test, expect, openMap, openSpot } from './fixtures'

test('adding a private parking draft survives reload and updates the profile', async ({
  page,
}) => {
  await openMap(page)
  await page.getByRole('button', { name: 'Add a spot', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Add parking', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Private draft · saved on this device only', {
      exact: true,
    }),
  ).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Name (optional)', exact: true })
    .fill('E2E private parking')
  await page
    .getByRole('button', { name: 'Save private draft', exact: true })
    .click()
  await expect(page.getByTestId('parking-detail-title')).toHaveText(
    'E2E private parking',
  )
  await expect(
    page.getByText('Private parking draft saved', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('parking-detail-title')).toHaveText(
    'E2E private parking',
  )
  await page.goto('/?panel=you')
  await expect(page.getByTestId('private-drafts')).toContainText(
    'E2E private parking',
  )
  await expect(page.getByTestId('private-drafts')).toContainText(
    'Not submitted',
  )
})

test('a correction requires an explanation before saving', async ({ page }) => {
  await openSpot(page)
  await page.getByTestId('parking-sheet-handle').click()
  await page
    .getByRole('button', { name: 'Suggest a correction', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Parking name', exact: true })
    .fill('Test parking')
  await page
    .getByRole('button', { name: 'Save correction on device', exact: true })
    .click()
  await expect(page.getByRole('alert')).toHaveText(
    'Describe what needs correcting.',
  )
  await page
    .getByRole('textbox', { name: 'What needs correcting?', exact: true })
    .fill('The posted parking hours have changed.')
  await page
    .getByRole('button', { name: 'Save correction on device', exact: true })
    .click()
  await expect(
    page.getByText('Correction draft saved', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Report information', exact: true }),
  ).toHaveCount(0)
})
