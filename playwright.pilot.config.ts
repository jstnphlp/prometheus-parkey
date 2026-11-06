import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PARKEY_E2E_PILOT_PORT || 8298)
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Pilot E2E port must be an integer between 1024 and 65535.')

export default defineConfig({
  testDir: './e2e/pilot',
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'output/playwright/pilot-report' }],
  ],
  outputDir: 'output/playwright/pilot-results',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'pilot-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'pilot-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm --filter @parkey/mobile web --host localhost --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      CI: '1',
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_PILOT_DISCOVERY_ENABLED: 'true',
      EXPO_PUBLIC_SUPABASE_URL: 'https://e2e.parkey.test',
      // Synthetic public fixture identifier; intercepted locally in the tests.
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_pilot_e2e_fixture',
      EXPO_PUBLIC_MAP_STYLE_URL: 'https://e2e.parkey.test/map-style.json',
      EXPO_PUBLIC_ANALYTICS_ENDPOINT: '',
      EXPO_PUBLIC_SENTRY_DSN: '',
      EXPO_PUBLIC_OSRM_URL: '',
      EXPO_PUBLIC_PHOTON_URL: '',
    },
  },
})
