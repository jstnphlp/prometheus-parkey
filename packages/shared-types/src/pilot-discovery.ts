import type { Coordinate, ParkingNavigationApproval } from './index'
import type {
  NcrEvidenceState,
  NcrFeatureType,
  NcrGeometry,
} from './ncr-discovery'

export type PilotCity = 'Manila' | 'Mandaluyong'
export type PilotMode = 'public' | 'candidate_research'
export type PilotBounds = {
  west: number
  south: number
  east: number
  north: number
}
export type PilotSource = {
  url: string | null
  license: string
  attribution: string
  updatedAt: string | null
}
export type PilotDestinationContext = {
  category?: string
  approximateStraightLineMeters?: number | null
  insideSourcePropertyFootprint?: boolean | null
  uncertainties?: string[]
  label: string
  destination: string
  sourceId: string
  sourceRecordUrl: string
  sourceLicense: string
  status: 'research_context_only'
  parkingNameConfirmed: false
  visitorAccessConfirmed: false
  navigationEntranceConfirmed: false
  publicationApproved: false
}
export type PilotParking = {
  id: string
  sourceObservationId: string
  name: string
  officialName: string | null
  descriptiveLabel: string | null
  featureType: NcrFeatureType
  geometry: NcrGeometry
  representativePoint: Coordinate
  accessClass: string
  restrictedAccess: boolean
  source: PilotSource & { kind: 'osm' | 'overture' | 'parkey' | 'community' }
  evidence: NcrEvidenceState
  navigationApproval: ParkingNavigationApproval | null
  reviewDueAt: string | null
  fees: string | null
  hours: string | null
  destinationContext: PilotDestinationContext[]
  warnings: string[]
}
export type PilotDestination = {
  id: string
  name: string
  category: string
  coordinate: Coordinate
  source: PilotSource
  publicationApproved: boolean
  reviewDueAt: string | null
  parkingIdentity: false
  parkingAccessConfirmed: false
}
export type PilotPage<T> = {
  schemaVersion: 1
  kind: 'pilot_discovery' | 'pilot_destinations'
  scopeVersion: 'manila-mandaluyong-v1'
  city: PilotCity
  mode: PilotMode
  records: T[]
  nextCursor: string | null
  notice: string
}
