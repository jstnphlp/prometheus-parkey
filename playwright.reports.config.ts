import { defineConfig } from '@playwright/test'

import base from './playwright.config'

if (!Array.isArray(base.webServer) || !base.webServer[0])
  throw new Error('Expected the isolated mobile web test server.')

export default defineConfig({
  ...base,
  testMatch: '**/report-submission.spec.ts',
  testIgnore: [],
  outputDir: 'output/playwright/reports-test-results',
  webServer: [
    {
      ...base.webServer[0],
      env: {
        ...base.webServer[0].env,
        EXPO_PUBLIC_REPORT_SUBMISSIONS_ENABLED: 'true',
        EXPO_PUBLIC_SUPABASE_URL: 'https://db.parkey.dev',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          'sb_publishable_fixture_only_0123456789',
      },
    },
  ],
})
