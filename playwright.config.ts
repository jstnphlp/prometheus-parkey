import { defineConfig, devices } from '@playwright/test'

const phase2Mode = process.env.PARKEY_E2E_DISCOVERY_MODE

export default defineConfig({
  testDir: './e2e',
  testMatch: phase2Mode ? 'phase2.spec.ts' : '**/*.spec.ts',
  testIgnore: phase2Mode ? [] : ['**/phase2.spec.ts'],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Software WebGL plus Metro overloads the standard two-core CI runner when
  // browser tests run concurrently. Keep each assertion's normal deadline.
  workers: process.env.CI ? 1 : 4,
  // Persistence cases intentionally cross several pages and reload bundles.
  timeout: 90_000,
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
    baseURL: 'http://localhost:8088',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm --filter @parkey/mobile web --host localhost --port 8088',
    url: 'http://localhost:8088',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      CI: '1',
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_MAP_STYLE_URL: 'https://e2e.parkey.test/map-style.json',
      EXPO_PUBLIC_PHOTON_URL: 'https://e2e.parkey.test/search',
      EXPO_PUBLIC_OSRM_URL: 'https://e2e.parkey.test',
      EXPO_PUBLIC_DISCOVERY_MODE: phase2Mode || '',
      EXPO_PUBLIC_SUPABASE_URL:
        phase2Mode === 'hosted' ? 'https://phase2.parkey.test' : '',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        phase2Mode === 'hosted' ? 'sb_publishable_synthetic_test' : '',
      EXPO_PUBLIC_ANALYTICS_ENDPOINT: '',
      EXPO_PUBLIC_SENTRY_DSN: '',
    },
  },
})
