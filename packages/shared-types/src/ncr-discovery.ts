import type { Coordinate } from './index'

export type NcrFeatureType =
  | 'lot'
  | 'garage'
  | 'facility_unspecified'
  | 'street_segment'
  | 'space'
  | 'entrance'

export type NcrGeometry =
  | { type: 'Point'; coordinates: Coordinate }
  | { type: 'LineString'; coordinates: Coordinate[] }
  | { type: 'MultiLineString'; coordinates: Coordinate[][] }
  | { type: 'Polygon'; coordinates: Coordinate[][] }
  | { type: 'MultiPolygon'; coordinates: Coordinate[][][] }

/** Separate evidence and approval facts; map ingestion advances none of them. */
export type NcrEvidenceState = {
  researchStatus: string
  onlineCorroborated: boolean
  operatorConfirmed: boolean
  physicallyVerified: boolean
  publicationApproved: boolean
}

export type NcrDiscoveryItem = {
  id: string
  name: string
  /** Research-only name provenance; never a current-business verification. */
  nameReview?: {
    status:
      | 'cross_source_name_candidate'
      | 'source_named_requires_cross_reference'
      | 'unnamed_pending_reference'
      | 'identity_or_name_conflict'
      | 'not_independent_facility'
    sourceNameIsDistinctive: boolean
    crossSourceCandidate: boolean
  }
  featureType: NcrFeatureType
  geometry: NcrGeometry
  representativePoint: Coordinate
  pointIsVehicleEntrance: false
  canNavigate: false
  accessClass: string
  restrictedAccess: boolean
  evidence: NcrEvidenceState
  publicationReview: {
    approvedAt: string | null
    reviewDueAt: string | null
  }
  source: {
    kind: 'osm' | 'overture'
    url: string
    license: string
    attribution: string
    observedAt: string | null
  }
  warnings: string[]
  reviewIssueIds: string[]
  fees: null
  hours: null
  capacity: null
  liveAvailability: null
}

export type NcrDiscoveryCluster = {
  id: string
  coordinate: Coordinate
  sourceObservationCount: number
  facilityCandidateCount: number
  byType: Partial<Record<NcrFeatureType, number>>
}

export type NcrDiscoveryResponse = {
  schemaVersion: 1
  mode: 'public' | 'research_preview'
  dataVersion: string
  generatedAt: string
  /** Earliest public approval deadline, including records represented by clusters. */
  reviewDueAt: string | null
  coverage: {
    sourceAsOf: string
    boundarySource: string
    scope: string
  }
  items: NcrDiscoveryItem[]
  clusters: NcrDiscoveryCluster[]
  nextCursor: string | null
  truncated: boolean
  totalMatched: number
  attribution: { label: string; url: string }[]
  notice: string
}
