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

/** Optional private review context; it never replaces the original source name. */
export type NcrNameEnrichment = {
  groupId: string
  classification:
    | 'credible_reusable_name_pending_review'
    | 'proposed_name_incomplete_or_conflicting'
    | 'nearby_named_property_only'
    | 'operator_or_brand_only'
    | 'no_reliable_name_evidence'
    | 'unsuitable_for_public_discovery'
  proposedName: string | null
  nameTagLeads: {
    name: string
    basis: string
    sourceId: string
    sourceRecordUrl: string
    sourceLicense: string
    approvedForPublication: false
  }[]
  nearbyParkingLeads: {
    name: string
    sourceId: string
    sourceRecordUrl: string
    sourceLicense: string
    sourceIndependent: boolean
    samePhysicalFacilityConfirmed: false
    usableAsParkingName: false
  }[]
  contextClues: {
    name: string
    sourceId: string
    sourceRecordUrl: string
    sourceLicense: string
    relation: string
    usableAsParkingName: false
  }[]
  operatorClues: {
    name: string
    kind: 'operator' | 'brand'
    recordId: string
    usableAsFacilityName: false
  }[]
  reviewLinks: {
    recordId: string
    coordinate: Coordinate
    googleMaps: string
    waze: string
  }[]
}

/** A destination association is descriptive research, never a parking identity. */
export type NcrDestinationLabel = {
  label: string
  destination: string
  category: string
  sourceId: string
  sourceRecordUrl: string
  approximateStraightLineMeters: number
  insideSourcePropertyFootprint: boolean
  sourceLicense?: 'ODbL-1.0'
  sourceSnapshotSha256?: string | null
  sourceRecordEditedAt?: string | null
  sourceVersion?: number | null
  sourceCoordinate?: Coordinate | null
  anchorCoordinate?: Coordinate | null
  parkingRecordId?: string | null
  distanceBasis?: 'source_geometry_anchor_haversine' | 'legacy_context_estimate'
  score?: number
  scoreComponents?: { category: number; proximity: number; containment: number }
  duplicateSourceIds?: string[]
  uncertainties?: string[]
  status: 'research_context_only'
  parkingNameConfirmed: false
  visitorAccessConfirmed: false
  navigationEntranceConfirmed: false
  publicationApproved: false
}

export type NcrDestinationReview = {
  outcome:
    | 'described'
    | 'ambiguous'
    | 'restricted_or_unsuitable'
    | 'no_suitable_destination'
    | 'previously_named'
    | 'not_facility'
  alternatives: NcrDestinationLabel[]
  reasons: string[]
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
    /** Private descriptive context, never an official parking name or public listing. */
    destinationLabel?: NcrDestinationLabel
    destinationReview?: NcrDestinationReview
    enrichment?: NcrNameEnrichment
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
