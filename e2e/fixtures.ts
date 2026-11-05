import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

import { isParking } from '../apps/mobile/src/discovery/data'

// All provider responses below are test fixtures, never live integration data.
export const spot = {
  id: 'osm:way/113539118',
  name: '1210',
  longitude: 121.029153425,
  latitude: 14.56586265,
}
export const spotPath = `/?${new URLSearchParams({
  spot: spot.id,
  lng: String(spot.longitude),
  lat: String(spot.latitude),
})}`

export const destination = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [121.0308, 14.5653],
      },
      properties: {
        osm_id: 123,
        name: 'Poblacion Test Cafe',
        street: 'Burgos Street',
        city: 'Makati',
        country: 'Philippines',
      },
    },
  ],
}

const origin = [121.0308, 14.5653]
export const drivingRoute = {
  code: 'Ok',
  routes: [
    {
      distance: 650,
      duration: 180,
      geometry: {
        type: 'LineString',
        coordinates: [
          origin,
          [121.0308, 14.56586265],
          [spot.longitude, spot.latitude],
        ],
      },
      legs: [
        {
          steps: [
            {
              distance: 250,
              name: 'Burgos Street',
              maneuver: {
                type: 'depart',
                bearing_after: 0,
                location: origin,
              },
            },
            {
              distance: 400,
              name: 'Test Street',
              maneuver: {
                type: 'turn',
                modifier: 'left',
                location: [121.0308, 14.56586265],
              },
            },
            {
              distance: 0,
              name: '',
              maneuver: {
                type: 'arrive',
                location: [spot.longitude, spot.latitude],
              },
            },
          ],
        },
      ],
    },
  ],
}

export const test = base.extend<{ reviewedNavigation: boolean }>({
  reviewedNavigation: [false, { option: true }],
  page: async ({ page, context, reviewedNavigation }, use) => {
    await context.setGeolocation({
      longitude: 121.0308,
      latitude: 14.5653,
      accuracy: 5,
    })
    await context.grantPermissions(['geolocation'])
    await page.route('https://e2e.parkey.test/**', async (route) => {
      const { pathname } = new URL(route.request().url())
      if (pathname === '/map-style.json') {
        await route.fulfill({
          json: {
            version: 8,
            glyphs: 'https://e2e.parkey.test/fonts/{fontstack}/{range}.pbf',
            sources: {},
            layers: [
              {
                id: 'background',
                type: 'background',
                paint: { 'background-color': '#f5f3ef' },
              },
            ],
          },
        })
      } else if (pathname.startsWith('/fonts/')) {
        await route.fulfill({
          contentType: 'application/x-protobuf',
          body: '',
        })
      } else if (pathname === '/rest/v1/rpc/discover_parking') {
        // Explicitly authorized synthetic entrance for routing tests only.
        // The bundled historical source archive remains unchanged/unverified.
        const archive: unknown = JSON.parse(
          readFileSync(
            new URL(
              '../apps/mobile/src/discovery/osm-pilot.json',
              import.meta.url,
            ),
            'utf8',
          ),
        )
        if (!Array.isArray(archive) || !archive.every(isParking))
          throw new Error('Invalid source fixture')
        const original = archive.find((record) => record.id === spot.id)
        if (!original) throw new Error('Expected source fixture record')
        await route.fulfill({
          json: {
            records: reviewedNavigation
              ? [
                  {
                    ...original,
                    entrances: [[spot.longitude, spot.latitude]],
                    navigationApproval: {
                      entrance: [spot.longitude, spot.latitude],
                      entranceConfirmed: true,
                      visitorAccessConfirmed: true,
                      operatorAuthorized: true,
                      expiresAt: new Date(Date.now() + 86400000).toISOString(),
                    },
                  },
                ]
              : [],
            truncated: false,
          },
        })
      } else if (pathname === '/search') {
        await route.fulfill({ json: destination })
      } else if (pathname.startsWith('/route/v1/driving/')) {
        await route.fulfill({ json: drivingRoute })
      } else {
        await route.abort()
      }
    })
    await use(page)
  },
})

export { expect }

export async function openMap(page: Page, path = '/') {
  await page.goto(path)
  // Expo serves a compilation shell before the map module is ready on cold CI.
  await expect(page.getByTestId('discovery-map-ready')).toBeVisible({
    timeout: 30_000,
  })
}

export async function openSpot(page: Page) {
  await openMap(page, spotPath)
  await expect(page.getByTestId('parking-detail-title')).toHaveText(spot.name)
}

export async function expandResults(page: Page) {
  const handle = page.getByTestId('parking-sheet-handle')
  await handle.click()
  await handle.click()
  await expect(handle).toHaveAccessibleName(/Parking sheet: full/)
}

export async function installNavigationSensor(page: Page) {
  // A deterministic sensor fixture emits fresh timestamped callbacks. Chromium's
  // context geolocation timestamp can predate a cold Expo compilation by >10s,
  // correctly failing the app's stale-fix check. Do not weaken that safeguard.
  // context.setGeolocation also resets the emulated sensor through an
  // unavailable error on each update, which correctly clears arrival evidence.
  // Avoid that reset while retaining the app's real consecutive-fix safeguards.
  await page.addInitScript(() => {
    let nextId = 1
    const listeners = new Map<number, EventListener>()
    navigator.geolocation.watchPosition = (success) => {
      const deliver = (longitude: number, latitude: number) =>
        success({
          coords: {
            longitude,
            latitude,
            accuracy: 5,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
          toJSON: () => ({}),
        })
      const listener: EventListener = (event) => {
        if (event instanceof CustomEvent)
          deliver(event.detail.longitude, event.detail.latitude)
      }
      const id = nextId++
      listeners.set(id, listener)
      globalThis.addEventListener('parkey-test-position', listener)
      setTimeout(() => deliver(121.0308, 14.5653), 0)
      return id
    }
    navigator.geolocation.clearWatch = (id) => {
      const listener = listeners.get(id)
      if (listener)
        globalThis.removeEventListener('parkey-test-position', listener)
      listeners.delete(id)
    }
  })
}
