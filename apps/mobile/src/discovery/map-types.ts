import type { Coordinate, DiscoveryParking } from '@parkey/shared-types'

import type { Destination } from './data'

import type { Viewport } from './model'
import type { DrivingRoute } from './routing'

export type CameraTarget = { coordinate: Coordinate; revision: number }
export type ParkingMapProps = {
  night?: boolean
  records: DiscoveryParking[]
  selectedId: string | null
  featuredId: string | null
  route: DrivingRoute | null
  navigation?:
    { following: boolean; along: number; onPan: () => void } | undefined
  target: CameraTarget
  cameraPadding: { top: number; bottom: number }
  parkedLocation: Coordinate | null
  userLocation: Coordinate | null
  destination: Coordinate | null
  draftPoints: Coordinate[]
  drawing: boolean
  searching?: boolean
  onPan?: () => void
  onSelect: (id: string) => void
  onPlaceSelect?: ((place: Destination) => void) | undefined
  onMapPress: (point: Coordinate) => void
  onViewport: (viewport: Viewport) => void
  onStatus: (status: 'loading' | 'ready' | 'error') => void
}
