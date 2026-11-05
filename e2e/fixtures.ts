import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

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
export const spotAreaPath = `/?${new URLSearchParams({
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

export const test = base.extend({
  page: async ({ page, context }, use) => {
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
  // Metro may still be compiling the first cold development bundle after HTTP
  // readiness. Wait for the app, rather than treating the bundling page as ready.
  await expect(page.getByTestId('discovery-map-ready')).toBeVisible({
    timeout: 60_000,
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

/** Uninterrupted GPS for nominal navigation; denial tests use the real browser API. */
export async function useNavigationGps(page: Page) {
  await page.addInitScript(() => {
    // Replacing Chromium's CDP geolocation override emits POSITION_UNAVAILABLE
    // before each fix. This fixture models uninterrupted GPS for the dwell test.
    const watches = new Map<number, PositionCallback>()
    let next = 0
    function position(
      longitude: number,
      latitude: number,
    ): GeolocationPosition {
      const values = {
        longitude,
        latitude,
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      }
      const coords = { ...values, toJSON: () => values }
      const timestamp = Date.now()
      return {
        coords,
        timestamp,
        toJSON: () => ({ coords: values, timestamp }),
      }
    }
    navigator.geolocation.watchPosition = (callback) => {
      const id = ++next
      watches.set(id, callback)
      queueMicrotask(() => callback(position(121.0308, 14.5653)))
      return id
    }
    navigator.geolocation.clearWatch = (id) => {
      watches.delete(id)
    }
    window.addEventListener('parkey-test-fix', (event) => {
      if (!(event instanceof CustomEvent)) return
      const point: unknown = event.detail
      if (
        !Array.isArray(point) ||
        typeof point[0] !== 'number' ||
        typeof point[1] !== 'number'
      )
        throw new Error('Invalid synthetic GPS fixture')
      const fix = position(point[0], point[1])
      for (const callback of watches.values()) callback(fix)
    })
  })
}
