/** Display metadata shared by the starter applications; not a domain model. */
export type {
  PilotCity,
  PilotMode,
  PilotBounds,
  PilotSource,
  PilotDestinationContext,
  PilotParking,
  PilotDestination,
  PilotPage,
} from './pilot-discovery'
export type {
  NcrFeatureType,
  NcrGeometry,
  NcrEvidenceState,
  NcrDiscoveryItem,
  NcrDestinationLabel,
  NcrDestinationReview,
  NcrDiscoveryCluster,
  NcrDiscoveryResponse,
} from './ncr-discovery'

export type AppInfo = {
  name: string
  description: string
}

/** Schema-backed vocabularies; no runtime values or authorization decisions. */
export type VerificationStatus =
  'pending' | 'verified' | 'rejected' | 'suspended'

export type OperatorStaffRole = 'owner' | 'staff'

export type InventoryUnitKind = 'dedicated_space' | 'capacity_unit'

export type ReservationStatus =
  | 'held'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'no_show'

/** Discovery API contracts. Coordinates follow GeoJSON: longitude, latitude. */
export type Coordinate = [longitude: number, latitude: number]
export type ParkingKind = 'street' | 'lot' | 'garage'
export type StreetSide = 'left' | 'right' | 'both' | 'unknown'
export type ParkingGeometry =
  | { type: 'Point'; coordinates: Coordinate }
  | { type: 'LineString'; coordinates: Coordinate[] }

export type ParkingRegulation = {
  description: string
  sourceLabel: string
  sourceUrl: string | null
  observedAt: string | null
}

/** Approved location photography; separate from private contribution evidence. */
export type ParkingPhoto = {
  id: string
  thumbnailUrl: string
  imageUrl: string
  caption: string
  credit: string
  sourceUrl: string
  license: string
}

export type DiscoveryParking = {
  id: string
  name: string
  kind: ParkingKind
  geometry: ParkingGeometry
  address: string | null
  side: StreetSide
  fees: string | null
  hours: string | null
  regulations: ParkingRegulation[]
  sourceKind: 'osm' | 'parkey' | 'community' | 'sample'
  sourceLabel: string
  sourceUrl: string | null
  license: string
  /** Raw OSM facts retained at import, never inferred client-side. */
  osmTags?: Record<string, string>
  osmEditedAt?: string | null
  entrances?: Coordinate[]
  /** Explicit, expiring reviewer authorization; mapped entrances alone grant none. */
  navigationApproval?: ParkingNavigationApproval | null
  sourceUpdatedAt: string | null
  verification: 'unverified' | 'verified'
  verifiedAt: string | null
}

export type ParkingNavigationApproval = {
  entrance: Coordinate
  entranceConfirmed: true
  visitorAccessConfirmed: true
  operatorAuthorized: true
  expiresAt: string
}

/** Review drafts never confer verification or permission to park. */
export type ParkingContribution = {
  id: string
  intent: 'add' | 'correction'
  targetId: string | null
  kind: ParkingKind
  geometry: ParkingGeometry
  side: StreetSide
  name: string
  restrictions: string
  hours: string
  fees: string
  photoUri: string | null
  createdAt: string
  status: 'local_pending_review'
}
