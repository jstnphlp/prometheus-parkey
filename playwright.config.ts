import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Cold Expo route compilation plus repeated navigations can exceed 30 s.
  // Keep every assertion; give sensor-backed flows their real 15 s deadline.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
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
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
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
        EXPO_PUBLIC_SUPABASE_URL: '',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
        EXPO_PUBLIC_ANALYTICS_ENDPOINT: '',
        EXPO_PUBLIC_SENTRY_DSN: '',
      },
    },
    {
      command:
        'node scripts/ncr-preview-server.mjs --development-preview --port 8090',
      url: 'http://127.0.0.1:8090/api/ncr/discovery?bbox=120.85,14.3,121.27,14.86&zoom=12',
      reuseExistingServer: false,
      timeout: 30_000,
      env: { NODE_ENV: 'development' },
    },
  ],
})
