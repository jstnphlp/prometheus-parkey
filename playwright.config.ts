import { defineConfig, devices } from '@playwright/test'

function e2ePort(value: string | undefined, fallback: number) {
  const port = value === undefined ? fallback : Number(value)
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('E2E ports must be integers between 1024 and 65535.')
  return port
}
const webPort = e2ePort(process.env.PARKEY_E2E_WEB_PORT, 8088)
const ncrPort = e2ePort(process.env.PARKEY_E2E_NCR_PORT, 8090)
if (webPort === ncrPort) throw new Error('E2E web and NCR ports must differ.')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Cold Expo route compilation plus repeated navigations can exceed 30 s.
  // Keep every assertion; give sensor-backed flows their real 15 s deadline.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Local Metro route bundling competes with existing previews. Serial local
  // execution avoids the reload/navigation timeouts observed in parallel runs.
  workers: process.env.CI ? 2 : 1,
  reporter: process.env.CI
    ? [
        ['line'],
        ['html', { open: 'never', outputFolder: 'output/playwright/report' }],
      ]
    : [
        ['list'],
        ['html', { open: 'never', outputFolder: 'output/playwright/report' }],
      ],
  outputDir: 'output/playwright/test-results',
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: `pnpm --filter @parkey/mobile web --host localhost --port ${webPort}`,
      url: `http://localhost:${webPort}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        CI: '1',
        EXPO_NO_DOTENV: '1',
        EXPO_PUBLIC_NCR_RESEARCH_URL: `http://127.0.0.1:${ncrPort}`,
        EXPO_PUBLIC_MAP_STYLE_URL: 'https://e2e.parkey.test/map-style.json',
        EXPO_PUBLIC_PHOTON_URL: 'https://e2e.parkey.test/search',
        EXPO_PUBLIC_OSRM_URL: 'https://e2e.parkey.test',
        EXPO_PUBLIC_SUPABASE_URL: '',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
        EXPO_PUBLIC_ANALYTICS_ENDPOINT: '',
        EXPO_PUBLIC_SENTRY_DSN: '',
      },
    },
    {
      command: `node scripts/ncr-preview-server.mjs --development-preview --port ${ncrPort} --enrichment data/ncr-destinations/2026-11-05/destination-enrichment.json.gz`,
      url: `http://127.0.0.1:${ncrPort}/api/ncr/discovery?bbox=120.85,14.3,121.27,14.86&zoom=12`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { NODE_ENV: 'development' },
    },
  ],
})
