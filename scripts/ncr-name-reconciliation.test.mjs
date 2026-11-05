import assert from 'node:assert/strict'
import test from 'node:test'
import { buildNameReconciliation, meaningfulParkingName } from './ncr-name-reconciliation.mjs'
import { loadNcrResearch } from './ncr-quality-review.mjs'

const facility=(id,name,sourceKind,point=[121.03,14.565],type='lot')=>({
  id,name,type,sourceKind,sourceRecordUrl:sourceKind==='osm'
    ? 'https://www.openstreetmap.org/node/1'
    : 'https://explore.overturemaps.org/',
  sourceLicense:sourceKind==='osm'?'ODbL-1.0':'CDLA-Permissive-2.0',
  sourceProviders:[{dataset:sourceKind==='osm'?'OpenStreetMap':'Overture',
    record_id:id,license:sourceKind==='osm'?'ODbL-1.0':'CDLA-Permissive-2.0'}],
  representativePoint:point,
})
const group=(id,ids)=>({
  id:'facility:'+id,sourceCandidateIds:ids,
  maximumLocationSpreadMeters:0,flags:[],
})
const data=()=>({
  schemaVersion:1,sourceAsOf:'2026-11-05T00:00:00Z',
  sourceHashes:{osm:'test',overture:'test'},
  candidates:[
    facility('osm:way/1:Polygon','Gateway Parking','osm'),
    facility('overture:1','Gateway Parking','overture',[121.0302,14.5651]),
    facility('osm:way/2:Polygon','Unnamed parking facility','osm',[121.06,14.565]),
    facility('overture:2','Parking lot','overture',[121.07,14.565]),
    facility('osm:node/3:Point','Mapped vehicle entrance','osm',[121.03,14.565],'entrance'),
  ],
  facilityGroups:[
    group('one',['osm:way/1:Polygon']),
    group('two',['overture:1']),
    group('three',['osm:way/2:Polygon']),
    group('four',['overture:2']),
  ],
})
test('only distinctive names qualify; source naming never asserts real-world verification',()=>{
  for(const s of ['Unnamed parking facility','Mapped vehicle entrance','Parking',
    'Parking Lot','Parking Garage','Carpark','P1','Open parking','Underground Parking'])
    assert.equal(meaningfulParkingName(s),false,s)
  for(const s of ['Gateway Underground Parking','SM Cubao Carpark','Parking Garage South','Parking Lot P3'])
    assert.equal(meaningfulParkingName(s),true,s)
})
test('cross-source same-name close matches are a review lead, never publication approval',()=>{
  const r=buildNameReconciliation(data())
  assert.equal(r.totals.facilityGroups,4)
  assert.equal(r.totals.childAndStreetObservationsExcludedFromFacilityNames,1)
  assert.equal(r.totals.cross_source_name_candidate,2)
  assert.equal(r.totals.unnamed_pending_reference,2)
  const g=r.groups.find(x=>x.groupId==='facility:one')
  assert.equal(g.proposedName,'Gateway Parking')
  assert.equal(g.matches.length,1)
  assert.equal(g.matches[0].samePhysicalFacilityVerified,false)
  assert.equal(g.publicationApproved,false)
  assert.equal(r.activePublicFacilityIds.length,0)
  assert.match(g.reviewLocations[0].navigationOnly.googleMaps,/google.com\/maps\/search/)
  assert.match(g.reviewLocations[0].navigationOnly.waze,/waze.com\/ul/)
})
test('provider overlap and distant same-name locations do not corroborate',()=>{
  const d=data()
  d.candidates[1].sourceProviders=[
    {dataset:'OpenStreetMap',record_id:'way/1',license:'ODbL-1.0'},
  ]
  assert.equal(buildNameReconciliation(d).totals.cross_source_name_candidate,undefined)
  d.candidates[1].sourceProviders=[
    {dataset:'Overture',record_id:'2',license:'CDLA-Permissive-2.0'},
  ]
  d.candidates[1].representativePoint=[121.06,14.6]
  assert.equal(buildNameReconciliation(d).totals.cross_source_name_candidate,undefined)
})
test('conflicts keep originals and do not silently rename or merge identities',()=>{
  const d=data()
  d.candidates[1].name='A Different Garage'
  d.facilityGroups[0].sourceCandidateIds.push('overture:1')
  d.facilityGroups.splice(1,1)
  const result=buildNameReconciliation(d)
  const r=result.groups.find(x=>x.groupId==='facility:one')
  assert.equal(r.nameStatus,'identity_or_name_conflict')
  assert.equal(r.proposedName,null)
  assert.equal(r.memberNames.length,2)
  assert.equal(result.groups.length,3)
})
test('invalid candidate IDs and missing groups fail before any data write',()=>{
  const d=data()
  d.candidates.push({...d.candidates[0]})
  assert.throws(()=>buildNameReconciliation(d),/Duplicate, invalid/)
  d.candidates.pop()
  d.facilityGroups.pop()
  assert.throws(()=>buildNameReconciliation(d),/Every facility observation/)
  d.facilityGroups.push(group('four',['overture:2']))
  d.candidates[0].representativePoint=[400,14]
  assert.throws(()=>buildNameReconciliation(d),/coordinate/)
})
test('report is deterministic and does not mutate source research',()=>{
  const d=data(),before=JSON.stringify(d)
  assert.deepEqual(buildNameReconciliation(d),buildNameReconciliation(d))
  assert.equal(JSON.stringify(d),before)
})

test('frozen NCR names reconcile without deleting or approving any of the 5,427 records', () => {
  const research = loadNcrResearch('data/ncr-research')
  const report = buildNameReconciliation(research)
  assert.equal(report.totals.sourceObservations, 5427)
  assert.equal(report.totals.facilityGroups, 3744)
  assert.equal(report.totals.facilityObservations, 3759)
  assert.equal(report.totals.childAndStreetObservationsExcludedFromFacilityNames, 1668)
  assert.equal(report.groups.length, 3744)
  assert.equal(report.activePublicFacilityIds.length, 0)
  assert.ok(report.groups.every((g) =>
    g.humanNameReviewRequired &&
    !g.publicationApproved &&
    !g.publicVisitorAccessConfirmed &&
    !g.operatingStatusConfirmed))
  const sourceIds = new Set(research.candidates.map((c) => c.id))
  assert.ok(report.groups.every((g) => g.candidateIds.every((id) => sourceIds.has(id))))
  // This is source-side matching only; never a Google/Waze place-content import.
  console.log('NCR name-reconciliation research counts:', report.totals)
})
