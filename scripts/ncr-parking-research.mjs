/**
 * Metro Manila offline *research-only* import.
 *
 * Inputs: licensed LGU boundaries (GeoJSON), filtered OSM (GeoJSON from osmium
 * export -a type,id), Overture Places (GeoJSON from our Azure export).
 * Never publishes, writes Supabase, touches the Poblacion review, or estimates
 * vacancy. Administrative coverage does not imply complete parking coverage.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { NCR_LGUS, validateNcrBoundaries, intersectingLgus,
  researchCell } from './ncr-geography.mjs'
import { distanceMeters } from './parking-open-data.mjs'

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const nonempty = (v) => typeof v === 'string' && v.trim() ? v.trim() : null
const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const parkingCategory = (v) => /(^|[_\s-])(parking|car_park|carpark|garage|parkade)($|[_\s-])/i
  .test(String(v || ''))
const geometryTypes = new Set(['Point','LineString','MultiLineString','Polygon','MultiPolygon'])
const restrictedAccess = new Set(['private','no','residents','permit','military','emergency'])
const streetPosition = new Set(['yes','lane','street_side','on_kerb',
  'half_on_kerb','shoulder','on_street','parallel','diagonal','perpendicular'])
const restrictedStreet = new Set(['no_parking','no_stopping','loading_only','emergency'])
const geomCoords = (g) => {
  if (g.type === 'Point') return [g.coordinates]
  if (g.type === 'LineString') return g.coordinates
  if (g.type === 'MultiLineString' || g.type === 'Polygon') return g.coordinates.flat()
  if (g.type === 'MultiPolygon') return g.coordinates.flat(2)
  return []
}
const representative = (geom) => {
  const points = geomCoords(geom)
  if (!points.length || points.some((p) => !Array.isArray(p) ||
      p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) ||
      p[0] < -180 || p[0] > 180 || p[1] < -90 || p[1] > 90))
    throw new Error('Invalid geometry coordinates.')
  if (geom.type === 'Point') return geom.coordinates.slice(0,2)
  const xs = points.map(p=>p[0]), ys=points.map(p=>p[1])
  return [(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2]
}
function sourceIdOfOsm(p, feature) {
  const type = nonempty(p['@type'] || p.osm_type)
  const objectId = p['@id'] ?? p.osm_id
  if (!['node','way','relation'].includes(type) ||
      !/^[1-9]\d*$/.test(String(objectId ?? '')))
    throw new Error('OSM source identity requires osmium export -a type,id.')
  // A way can export as an area AND as a line; preserve both geometries.
  return { id:'osm:'+type+'/'+String(objectId)+':'+feature.geometry.type,
    url:'https://www.openstreetmap.org/'+type+'/'+objectId }
}
function streetSides(p) {
  const found = []
  for (const side of ['left','right','both']) {
    const current = nonempty(p['parking:'+side])
    const old = nonempty(p['parking:lane:'+side])
    const position = (current || old || '').toLowerCase()
    const restriction = String(p['parking:'+side+':restriction'] ||
      p['parking:condition:'+side] || '').toLowerCase()
    const access = String(p['parking:'+side+':access'] || '').toLowerCase()
    if (streetPosition.has(position) && !restrictedStreet.has(restriction) &&
        !restrictedAccess.has(access)) {
      found.push(side)
    }
  }
  return found
}
function normalizeOsm(feature) {
  const p = feature?.properties
  const g = feature?.geometry
  if (!p || !geometryTypes.has(g?.type)) return null
  const isStreet = g.type === 'LineString' || g.type === 'MultiLineString'
  const sides = isStreet && nonempty(p.highway) ? streetSides(p) : []
  const amenity = p.amenity
  let type = null
  if (amenity === 'parking') {
    type = ['multi-storey','underground','rooftop'].includes(p.parking)
      ? 'garage' : 'lot'
  } else if (amenity === 'parking_space') type = 'space'
  else if (amenity === 'parking_entrance') type = 'entrance'
  else if (sides.length) type = 'street_segment'
  if (!type) return null
  const {id,url} = sourceIdOfOsm(p,feature)
  const access = nonempty(p.access || p['parking:access'])
  const restricted = access ? restrictedAccess.has(access.toLowerCase()) : false
  const streetConditional = Object.keys(p).some((key) =>
    key.startsWith('parking:') && (key.endsWith(':conditional') ||
    key.includes(':restriction') || key.includes(':maxstay')))
  return {
    id, name:nonempty(p.name) ||
      (type === 'street_segment' ? 'Mapped street-parking segment' :
       type === 'space' ? 'Mapped individual parking bay' :
       type === 'entrance' ? 'Mapped vehicle entrance' : 'Unnamed parking facility'),
    type, geometry:g, sourceKind:'osm', sourceRecordUrl:url,
    sourceLicense:'ODbL-1.0', sourceAttribution:'© OpenStreetMap contributors',
    sourceConfidence:null, accessClass:access || 'unknown', restrictedAccess:restricted,
    streetSides:sides, streetRestrictionsNeedReview:type === 'street_segment',
    conditionalRulesPresent:streetConditional, sourceTags:p,
    sourceRecordEditedAt:nonempty(p['@timestamp']) || null,
  }
}
function normalizeOverture(feature) {
  const p = feature?.properties, g = feature?.geometry
  if (!p || g?.type !== 'Point') return null
  const id = nonempty(feature.id || p.id)
  const name = nonempty(p.names?.primary || p.name)
  const category = nonempty(p.taxonomy?.primary || p.basic_category)
  if (!id || !name || !parkingCategory(category)) return null
  const cat = String(category).toLowerCase()
  const type = /parking_space|parking_bay/.test(cat) ? 'space' :
    /parking_entrance/.test(cat) ? 'entrance' :
    /garage|parkade|multistorey|multi_storey/.test(cat) ? 'garage' : 'lot'
  const rawSources = Array.isArray(p.sources) ? p.sources : (()=> {
    if (typeof p.sources_json !== 'string') return []
    try { return JSON.parse(p.sources_json) } catch { return [] }
  })()
  const sourceLicenses = [...new Set((Array.isArray(rawSources)?rawSources:[])
    .map((s)=>nonempty(s.license)).filter(Boolean))]
  return {
    id:'overture:'+id, name, type, geometry:g, sourceKind:'overture',
    sourceRecordUrl:'https://explore.overturemaps.org/',
    sourceLicense:sourceLicenses.join(', ') || 'unknown',
    sourceAttribution:'Overture Maps Foundation — verify record-level providers',
    sourceConfidence:typeof p.confidence === 'number' ? p.confidence : null,
    accessClass:'unknown', restrictedAccess:false, streetSides:[],
    streetRestrictionsNeedReview:false, conditionalRulesPresent:false,
    sourceTags:{basic_category:p.basic_category??null, taxonomy:p.taxonomy??null},
    sourceRecordEditedAt:null,
  }
}
export function classifyGeojson(collection, source) {
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features))
    throw new Error('Expected source GeoJSON FeatureCollection.')
  if (!['osm','overture'].includes(source)) throw new Error('Unknown source type.')
  const out=[]
  for(const feature of collection.features) {
    const item=source==='osm'?normalizeOsm(feature):normalizeOverture(feature)
    if(item) out.push(item)
  }
  return out
}
function nearDuplicates(candidates) {
  const bins=new Map(),pairs=[]
  const key=(p)=>Math.floor(p[0]*1000)+':'+Math.floor(p[1]*1000)
  for(const c of candidates) {
    if (!['lot','garage'].includes(c.type) || norm(c.name).startsWith('unnamed')) continue
    const [x,y]=c.representativePoint
    const xi=Math.floor(x*1000),yi=Math.floor(y*1000)
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      for(const prev of bins.get((xi+dx)+':'+(yi+dy))||[]) {
        if(norm(prev.name)!==norm(c.name))continue
        const meters=distanceMeters(prev.representativePoint,c.representativePoint)
        if(meters<=100) {
          pairs.push({ firstId:prev.id, secondId:c.id, meters,
            status:'manual_identity_review_required' })
          if(pairs.length>50000)throw new Error('Excessive duplicate candidates.')
        }
      }
    }
    bins.set(key(c.representativePoint),[...(bins.get(key(c.representativePoint))||[]),c])
  }
  return pairs.sort((a,b)=>a.firstId.localeCompare(b.firstId)||a.secondId.localeCompare(b.secondId))
}
/** Source-independent staging. No output is ever approved for publication. */
export function buildNcrResearch({ boundaryGeojson, osmGeojson=null,
  overtureGeojson=null, asOf, inputHashes }) {
  if (!Number.isFinite(Date.parse(asOf)) || !/Z$/.test(asOf) ||
      Date.parse(asOf) > Date.now()) throw new Error('Use a nonfuture UTC ISO --as-of.')
  if (!osmGeojson && !overtureGeojson)throw new Error('At least one source is required.')
  const boundaries=validateNcrBoundaries(boundaryGeojson)
  const raws=[
    ...(osmGeojson?classifyGeojson(osmGeojson,'osm'):[]),
    ...(overtureGeojson?classifyGeojson(overtureGeojson,'overture'):[]),
  ]
  const ids=new Set(),candidates=[]
  const excluded={outsideNcr:0,restricted:0,streetRequiresLegalReview:0,unknownLicense:0}
  for(const candidate of raws){
    if(ids.has(candidate.id))throw new Error('Duplicate source ID: '+candidate.id)
    ids.add(candidate.id)
    const lgus=intersectingLgus(candidate.geometry,boundaries)
    if(!lgus.length){excluded.outsideNcr++;continue}
    const representativePoint=representative(candidate.geometry)
    const record={
      ...candidate, lgus, representativePoint,
      pointIsVehicleEntrance:false,
      researchCell:researchCell(representativePoint),
      verification:'unverified', verifiedAt:null, publicationApproved:false,
      accessConfirmed:false, capacity:null, liveAvailability:null,
      fees:null, hours:null,
      // Decisions are explicitly NOT made by this source-only importer.
      displayEligibility:'pending_human_and_license_review',
      flags:[
        ...(candidate.restrictedAccess?['mapped_restricted_access']:[]),
        ...(candidate.type==='street_segment'?['street_legality_unconfirmed']:[]),
        ...(candidate.type==='space'?['individual_bay_not_independent_facility']:[]),
        ...(candidate.type==='entrance'?['entrance_not_independent_parking']:[]),
        ...(candidate.sourceLicense==='unknown'?['license_review_required']:[]),
        ...(candidate.geometry.type!=='Point'?['representative_point_not_entrance']:[]),
        ...(candidate.conditionalRulesPresent?['conditional_rules_need_review']:[]),
      ],
    }
    if(record.restrictedAccess)excluded.restricted++
    if(record.streetRestrictionsNeedReview)excluded.streetRequiresLegalReview++
    if(record.sourceLicense==='unknown')excluded.unknownLicense++
    candidates.push(record)
  }
  candidates.sort((a,b)=>a.id.localeCompare(b.id))
  const duplicates=nearDuplicates(candidates)
  const perLgu=Object.fromEntries(NCR_LGUS.map((name)=>[name,{
    mappedEntities:0,lots:0,garages:0,individualBays:0,streetSegments:0,entrances:0,
  }]))
  const cellMap=new Map()
  for(const c of candidates){
    for(const lgu of c.lgus){
      const row=perLgu[lgu];row.mappedEntities++
      if(c.type==='lot')row.lots++
      else if(c.type==='garage')row.garages++
      else if(c.type==='space')row.individualBays++
      else if(c.type==='street_segment')row.streetSegments++
      else if(c.type==='entrance')row.entrances++
    }
    let row=cellMap.get(c.researchCell)
    if(!row){row={researchCell:c.researchCell,sourceEntities:0,facilityCandidates:0,
      individualBays:0,streetSegments:0,unknownAccessOrRestricted:0};cellMap.set(c.researchCell,row)}
    row.sourceEntities++
    if(['lot','garage'].includes(c.type))row.facilityCandidates++
    if(c.type==='space')row.individualBays++
    if(c.type==='street_segment')row.streetSegments++
    if(c.accessClass==='unknown'||c.restrictedAccess)row.unknownAccessOrRestricted++
  }
  return {
    schemaVersion:1,scope:'Metro Manila (NCR), all 17 LGUs',
    sourceAsOf:asOf,sourceHashes:inputHashes,
    inputsProvided:{osm:!!osmGeojson,overture:!!overtureGeojson},
    policy:'Offline mapping research only. Mapped supply is not available parking; zero mapped entities does not mean zero parking. Polygon representative points are NOT entrances; no publication, permissions, legality, prices, capacity or live vacancy are inferred. Map presentation requires separate human, license and safety review.',
    counts:{rawParkingCandidates:raws.length,insideNcr:candidates.length,
      byType:Object.fromEntries(['lot','garage','space','street_segment','entrance']
        .map(t=>[t,candidates.filter(c=>c.type===t).length])),
      ...excluded,possibleDuplicatePairs:duplicates.length,physicallyVerified:0,
      publicationApproved:0},
    perLgu,cells:[...cellMap.values()].sort((a,b)=>a.researchCell.localeCompare(b.researchCell)),
    duplicateReviewPairs:duplicates,candidates,
  }
}
function main() {
  const args=process.argv.slice(2)
  const get=(flag)=>{const i=args.indexOf(flag);return i===-1?null:args[i+1]}
  const boundaryPath=get('--boundaries'),osmPath=get('--osm'),
    overturePath=get('--overture'),outputPath=get('--out'),asOf=get('--as-of')
  const allowed=new Set(['--boundaries','--osm','--overture','--out','--as-of'])
  if (!boundaryPath || !outputPath || !asOf || (!osmPath && !overturePath) ||
      args.length%2!==0 ||
      args.some((a,i)=>i%2===0?(!allowed.has(a)||!args[i+1]||args[i+1].startsWith('--')):false) ||
      new Set(args.filter((a,i)=>i%2===0)).size!==args.length/2)
    throw new Error('Usage: node scripts/ncr-parking-research.mjs --boundaries ncr-lgus.geojson --osm ncr-osm.geojson [--overture ncr-overture.geojson] --as-of UTC_ISO --out output/ncr-research.json')
  const read=(path)=>{const bytes=readFileSync(path);return {parsed:JSON.parse(bytes.toString('utf8')),sha256:hash(bytes)}}
  const bounds=read(boundaryPath), osm=osmPath?read(osmPath):null,
    overture=overturePath?read(overturePath):null
  const result=buildNcrResearch({
    boundaryGeojson:bounds.parsed,osmGeojson:osm?.parsed,overtureGeojson:overture?.parsed,
    asOf,inputHashes:{boundaries:bounds.sha256,...(osm?{osm:osm.sha256}:{}),
      ...(overture?{overture:overture.sha256}:{})},
  })
  mkdirSync(dirname(outputPath),{recursive:true})
  writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
  process.stdout.write(JSON.stringify({
    counts:result.counts,
    lguCoverage:Object.entries(result.perLgu).map(([name,v])=>({name,mapped:v.mappedEntities})),
    output:outputPath,
  },null,2)+'\n')
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{main()}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1}
}
