import assert from 'node:assert/strict'
import test from 'node:test'
import { NCR_LGUS } from './ncr-geography.mjs'
import { buildNcrResearch, classifyGeojson } from './ncr-parking-research.mjs'

const square=(x,y,w=0.012)=>({
  type:'Polygon',coordinates:[[[x,y],[x+w,y],[x+w,y+w],[x,y+w],[x,y]]],
})
const ncr={
  type:'FeatureCollection',
  features:NCR_LGUS.map((name,i)=>({
    type:'Feature',properties:{lgu:name},
    geometry:square(120.9+i*.016,14.5),
  })),
}
const point=(x,y)=>({type:'Point',coordinates:[x,y]})
const osm=(id,p,geometry=point(120.938,14.506),type='node')=>({
  type:'Feature',properties:{'@type':type,'@id':id,...p},geometry,
})
const geo=(...features)=>({type:'FeatureCollection',features})
const osmSource=geo(
  osm(10,{amenity:'parking',parking:'multi-storey',name:'Test Garage'},
    square(120.937,14.504), 'way'),
  osm(11,{amenity:'parking_space',ref:'B24'}),
  osm(12,{amenity:'parking_entrance'}),
  osm(13,{highway:'residential',name:'Example Road',
    'parking:left':'no','parking:right':'lane'},
    {type:'LineString',coordinates:[[120.936,14.506],[120.943,14.506]]},'way'),
  osm(14,{highway:'residential','parking:both':'no'},
    {type:'LineString',coordinates:[[120.936,14.507],[120.943,14.507]]},'way'),
  osm(15,{amenity:'parking',access:'private',name:'Private Lot'}),
  osm(16,{amenity:'parking',name:'Outside NCR'},point(123,11)),
)
const overture=geo({
  type:'Feature',
  properties:{id:'over-a',name:'Test Garage',basic_category:'parking',
    confidence:0.4},
  geometry:point(120.943,14.509),
})
const asOf='2026-11-03T13:23:54Z'
const run=(patch={})=>buildNcrResearch({
  boundaryGeojson:ncr,osmGeojson:osmSource,overtureGeojson:overture,asOf,
  inputHashes:{boundaries:'test',osm:'test',overture:'test'},...patch,
})

test('keeps facilities, individual spaces, entrances, and legal-unknown curb segments separate',()=>{
  const r=run()
  assert.equal(r.counts.rawParkingCandidates,7)
  assert.equal(r.counts.insideNcr,6)
  assert.deepEqual(r.counts.byType,{
    lot:1,garage:2,space:1,street_segment:1,entrance:1,
  })
  assert.equal(r.counts.streetRequiresLegalReview,1)
  assert.equal(r.counts.restricted,1)
  assert.equal(r.counts.unknownLicense,1)
  assert.equal(r.counts.physicallyVerified,0)
  assert.equal(r.counts.publicationApproved,0)
  assert.equal(r.counts.possibleDuplicatePairs,1)
  const street=r.candidates.find(c=>c.type==='street_segment')
  assert.deepEqual(street.streetSides,['right'])
  assert.ok(street.flags.includes('street_legality_unconfirmed'))
  const garage=r.candidates.find(c=>c.id==='osm:way/10:Polygon')
  assert.deepEqual(garage.lgus,['Makati'])
  assert.ok(garage.flags.includes('representative_point_not_entrance'))
  assert.equal(garage.accessConfirmed,false)
  assert.equal(garage.pointIsVehicleEntrance,false)
  assert.equal(r.perLgu.Makati.mappedEntities,6)
  assert.equal(r.candidates.some(c=>c.id.includes('14:')),false)
  assert.equal(r.candidates.some(c=>c.name==='Outside NCR'),false)
})
test('does not publish private or Overture-unknown-license records',()=>{
  const r=run()
  const privateLot=r.candidates.find(c=>c.name==='Private Lot')
  assert.ok(privateLot.flags.includes('mapped_restricted_access'))
  const fromOverture=r.candidates.find(c=>c.sourceKind==='overture')
  assert.ok(fromOverture.flags.includes('license_review_required'))
  assert.ok(r.candidates.every(c=>c.verification==='unverified' &&
    c.publicationApproved===false && c.displayEligibility==='pending_human_and_license_review'))
})
test('input geometry, identity and snapshot failures are explicit',()=>{
  assert.throws(()=>run({asOf:'2099-01-01T00:00:00Z'}),/nonfuture/)
  assert.throws(()=>run({osmGeojson:geo(osm(null,{amenity:'parking'}))}),/source identity/)
  assert.throws(()=>run({osmGeojson:geo(osm(10,{amenity:'parking'}),
    osm(10,{amenity:'parking'}))}),/Duplicate source ID/)
  assert.throws(()=>run({boundaryGeojson:{type:'FeatureCollection',features:[]}}),/Expected 17/)
  assert.throws(()=>run({osmGeojson:null,overtureGeojson:null}),/At least one source/)
})
test('identical inputs give identical reports without mutating sources',()=>{
  const before=JSON.stringify({ncr,osmSource,overture})
  assert.deepEqual(run(),run())
  assert.equal(JSON.stringify({ncr,osmSource,overture}),before)
  assert.equal(Object.keys(run().perLgu).length,17)
})
test('explicit no-parking tags and unrelated shops are not parking supply',()=>{
  assert.equal(classifyGeojson(geo(
    osm(22,{highway:'residential','parking:both':'no'},
      {type:'LineString',coordinates:[[120.936,14.506],[120.938,14.506]]},'way'),
    osm(23,{amenity:'restaurant'}),
  ),'osm').length,0)
})
