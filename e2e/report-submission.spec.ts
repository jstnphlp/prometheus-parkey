import type { Page } from '@playwright/test'

import { test, expect, openMap } from './fixtures'

const token = 'synthetic_auth_session_private.header.signature'
const receiptId = '22222222-2222-4222-8222-222222222222'
const draft = {
  id: 'local-synthetic-review',
  intent: 'add',
  targetId: null,
  name: 'Synthetic private report',
  kind: 'lot',
  geometry: { type: 'Point', coordinates: [121.03, 14.56] },
  side: 'unknown',
  restrictions: 'Synthetic restriction for QA',
  hours: '',
  fees: '',
  photoUri: 'file:///private-photo-never-uploaded.jpg',
  createdAt: '2026-11-09T08:00:00Z',
  status: 'local_pending_review',
}

async function setup(
  page: Page,
  options: { failSubmit?: boolean; delayVerification?: Promise<void> } = {},
) {
  const submissions: unknown[] = []
  let received = false
  await page.addInitScript(
    (value) =>
      localStorage.setItem(
        'parkey.discovery.local-reviews.v1',
        JSON.stringify([value]),
      ),
    draft,
  )
  await page.route('https://db.parkey.dev/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/rest/v1/rpc/discover_parking')
      return route.fulfill({ json: { records: [], truncated: false } })
    if (path === '/auth/v1/otp') return route.fulfill({ json: {} })
    if (path === '/auth/v1/verify') {
      await options.delayVerification
      await route
        .fulfill({
          json: {
            access_token: token,
            refresh_token: 'synthetic_refresh_never_persisted',
            expires_in: 3600,
            user: {
              id: '11111111-1111-4111-8111-111111111111',
              email_confirmed_at: '2026-11-01T00:00:00Z',
              is_anonymous: false,
            },
          },
        })
        .catch(() => undefined)
      return
    }
    if (path === '/functions/v1/mobile-reports') {
      const body: unknown = route.request().postDataJSON()
      if (!body || typeof body !== 'object' || !('action' in body))
        throw new Error('Invalid fixture request')
      if (body.action === 'submit') {
        submissions.push(body)
        if (options.failSubmit)
          return route.fulfill({
            status: 503,
            json: { error: 'Synthetic unavailable service' },
          })
        received = true
      }
      if (body.action === 'withdraw')
        return route.fulfill({
          json: {
            state: 'withdrawn',
            receiptId,
            receivedAt: new Date().toISOString(),
          },
        })
      return route.fulfill({
        status: body.action === 'submit' ? 202 : 200,
        json: received
          ? {
              state: 'received',
              receiptId,
              receivedAt: new Date().toISOString(),
            }
          : { state: 'not_sent' },
      })
    }
    throw new Error(`Unexpected fixture endpoint ${path}`)
  })
  await openMap(page)
  await page.getByRole('tab', { name: 'You', exact: true }).click()
  await page.getByRole('button', { name: 'Review report', exact: true }).click()
  await expect(
    page.getByText('Verify email to send or manage a report'),
  ).toBeVisible()
  return submissions
}
async function verify(page: Page) {
  await page
    .getByRole('textbox', { name: 'Report verification email' })
    .fill('synthetic@example.org')
  await page
    .getByRole('button', { name: 'Email verification code', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Email verification code', exact: true })
    .fill('123456')
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await expect(
    page.getByText('Email verified for this panel.', { exact: true }),
  ).toBeVisible()
}
test('drafts are explicit opt-in submissions and only a receipt is persisted', async ({
  page,
}) => {
  const submissions = await setup(page)
  expect(submissions).toHaveLength(0)
  await verify(page)
  expect(submissions).toHaveLength(0)
  await expect(
    page.getByRole('button', { name: 'Send for review', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('textbox', { name: 'Report observation date' })
    .fill(new Date().toISOString().slice(0, 10))
  await page
    .getByText(
      'I agree to send this text report and its map location for private review.',
      { exact: true },
    )
    .click()
  await page
    .getByRole('button', { name: 'Send for review', exact: true })
    .click()
  await expect(
    page
      .getByTestId('report-submission')
      .getByText('Sent for private review', { exact: true }),
  ).toBeVisible()
  expect(submissions).toHaveLength(1)
  expect(JSON.stringify(submissions)).not.toContain('private-photo')
  expect(JSON.stringify(submissions)).not.toContain('local_pending_review')
  const stored = await page.evaluate(() =>
    Object.values(localStorage).join(' '),
  )
  expect(stored).not.toContain(token)
  expect(stored).not.toContain('synthetic_refresh_never_persisted')
  await page
    .getByRole('button', { name: 'Back to local reports', exact: true })
    .click()
  await page.getByRole('button', { name: 'Review report', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Email verification code', exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByTestId('report-submission')
      .getByText('Sent for private review', { exact: true }),
  ).toBeVisible()
  expect(submissions).toHaveLength(1)
})
test('failed delivery retains the local report and never claims receipt', async ({
  page,
}) => {
  const submissions = await setup(page, { failSubmit: true })
  await verify(page)
  await page
    .getByRole('textbox', { name: 'Report observation date' })
    .fill(new Date().toISOString().slice(0, 10))
  await page
    .getByText(
      'I agree to send this text report and its map location for private review.',
      { exact: true },
    )
    .click()
  await page
    .getByRole('button', { name: 'Send for review', exact: true })
    .click()
  await expect(page.getByText(/could not confirm delivery/)).toBeVisible()
  await expect(
    page
      .getByTestId('report-submission')
      .getByText('Sent for private review', { exact: true }),
  ).toHaveCount(0)
  expect(submissions).toHaveLength(1)
  const stored = await page.evaluate(() =>
    localStorage.getItem('parkey.discovery.local-reviews.v1'),
  )
  expect(stored).toContain('Synthetic private report')
  expect(stored).not.toContain('receiptId')
})
test('closing during verification discards the late session and never submits', async ({
  page,
}) => {
  let release: () => void = () => undefined
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  const submissions = await setup(page, { delayVerification: wait })
  await page
    .getByRole('textbox', { name: 'Report verification email' })
    .fill('synthetic@example.org')
  await page
    .getByRole('button', { name: 'Email verification code', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Email verification code', exact: true })
    .fill('123456')
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await page
    .getByRole('button', { name: 'Back to local reports', exact: true })
    .click()
  release()
  await page.getByRole('button', { name: 'Review report', exact: true }).click()
  await expect(
    page.getByRole('textbox', { name: 'Report verification email' }),
  ).toHaveValue('')
  await expect(
    page.getByRole('button', { name: 'Email verification code', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Email verified for this panel.', { exact: true }),
  ).toHaveCount(0)
  expect(submissions).toHaveLength(0)
})
