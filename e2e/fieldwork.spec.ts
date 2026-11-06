import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const html = readFileSync('docs/ncr-fieldwork-form.html', 'utf8')
const fixture = () => ({
  schemaVersion: 1,
  sourceHashes: { osm: 'synthetic-e2e-fixture' },
  sourceAsOf: new Date(Date.now() - 3_600_000).toISOString(),
  questions: {
    identity: 'Confirm the source object and remaining uncertainty.',
  },
  visitPeriods: {
    poblacion: 'Synthetic proposed test period, not observed hours.',
  },
  permissionInstructions: { ordinary: 'Use lawful public approaches only.' },
  readinessImpacts: { facility: 'Human reconciliation remains required.' },
  routes: [{ id: 'poblacion-owner', priority: 1 }],
  tasks: [
    {
      id: 'osm:node/1:Point',
      name: 'Synthetic fixture — no actual visit',
      coordinates: [121.03, 14.567],
      firstWave: true,
      routeId: 'poblacion-owner',
      researchStatus: 'researched',
      verificationStatus: 'unverified',
      remoteEstablished: {
        sourceKind: 'osm',
        mappedType: 'facility_unspecified',
        mappedAccess: 'unknown',
        sourceEditedAt: null,
        sourceRecordUrl: 'https://www.openstreetmap.org/node/1',
        independentReferences: [],
      },
      uncertainties: ['Access is unknown'],
      suggestedVisitPeriodKey: 'poblacion',
      operatorPermissionNeededKey: 'ordinary',
      readinessImpactKey: 'facility',
      questionKeys: ['identity'],
    },
  ],
})

test('private field form shows source anchors and refuses an empty or unattested observation', async ({
  page,
}) => {
  await page.setContent(html)
  await page.getByLabel('Load fieldwork checklist JSON').setInputFiles({
    name: 'fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture())),
  })
  await expect(
    page.getByText(
      'Checklist loaded locally. No record has been verified or published.',
    ),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /query=14\.567/ }),
  ).toHaveAttribute(
    'href',
    'https://www.google.com/maps/search/?api=1&query=14.567%2C121.03',
  )
  await expect(
    page.getByText('Research anchor; not a confirmed vehicle entrance.', {
      exact: false,
    }),
  ).toBeVisible()
  let downloads = 0
  page.on('download', () => {
    downloads++
  })
  await page
    .getByRole('button', { name: 'Export unreviewed field submission' })
    .click()
  expect(downloads).toBe(0)
  expect(
    await page
      .getByLabel('I personally made this actual on-site observation', {
        exact: false,
      })
      .isChecked(),
  ).toBe(false)
})

test('synthetic field evidence exports as unreviewed with optional locally sanitized PNG', async ({
  page,
}) => {
  await page.setContent(html)
  await page.getByLabel('Load fieldwork checklist JSON').setInputFiles({
    name: 'fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture())),
  })
  await page
    .getByLabel('Non-personal observer/evidence reference')
    .fill('synthetic-browser-test')
  const localTime = await page.evaluate(() => {
    const date = new Date(Date.now() - 60_000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  })
  await page.getByLabel('Actual visit date and time').fill(localTime)
  await page
    .getByLabel('What you actually observed and what remains uncertain')
    .fill('Synthetic browser fixture only; no actual site visit occurred.')
  await page
    .getByLabel('I personally made this actual on-site observation', {
      exact: false,
    })
    .check()
  await page
    .getByLabel('I observed access/photography rules', { exact: false })
    .check()
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 2
    return canvas.toDataURL('image/png').split(',')[1] || ''
  })
  await page
    .getByLabel('Optional permitted photographs (up to three)')
    .setInputFiles({
      name: 'synthetic.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    })
  const downloadPromise = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Export unreviewed field submission' })
    .click()
  const download = await downloadPromise
  const downloadPath = await download.path()
  expect(downloadPath).not.toBeNull()
  if (!downloadPath) throw new Error('Missing browser download')
  const submission = JSON.parse(readFileSync(downloadPath, 'utf8'))
  expect(submission.status).toBe('submitted_unreviewed')
  expect(submission.candidateId).toBe('osm:node/1:Point')
  expect(submission.facts.entranceCoordinates).toBeNull()
  expect(submission.photos).toHaveLength(1)
  expect(submission.photos[0].dataUrl).toMatch(/^data:image\/png;base64,/)
  expect(submission.publicationApproved).toBeUndefined()
  expect(submission.verification).toBeUndefined()
})
