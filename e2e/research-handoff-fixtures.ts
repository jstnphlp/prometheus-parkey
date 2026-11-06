import type { BrowserContext, Page } from '@playwright/test'

// This is a browser-navigation fixture, never a hosted Research Console or data API.
export const researchConsoleUrl = 'https://research-console.parkey.test/review'

export async function mockExternalConsole(context: BrowserContext) {
  await context.route(`${researchConsoleUrl}**`, async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Navigation fixture</title><h1>External console navigation fixture</h1>',
    })
  })
}

export function watchResearchReads(page: Page) {
  const calls: string[] = []
  page.on('request', (request) => {
    const pilotRead =
      /\/rest\/v1\/rpc\/(?:discover_pilot_parking|discover_pilot_destinations|get_pilot_parking)/.test(
        request.url(),
      )
    if (
      /\/api\/ncr\//.test(request.url()) ||
      (pilotRead &&
        /"p_mode"\s*:\s*"candidate_research"/.test(request.postData() || ''))
    )
      calls.push(request.url())
  })
  return calls
}
