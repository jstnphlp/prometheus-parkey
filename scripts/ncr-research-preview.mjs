/**
 * Offline, aggregate-only NCR research heatmap (no tiles, API calls or parking directions).
 * Run locally for audit; deliberately does not create a mobile/public discovery feed.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'

const assertNumber=(v)=>Number.isFinite(v)&&v>=0
const integer=(v)=>Number.isInteger(v)&&v>=0
const validBox=(b)=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&
  b[0]>=-180&&b[2]<=180&&b[1]>=-90&&b[3]<=90&&b[0]<b[2]&&b[1]<b[3]
const maxValue=(cells,kind)=>Math.max(1,...cells.map(c=>count(c,kind)))
const count=(c,mode)=>{
  if(mode==='mapped')return c.mappedEntities
  if(mode==='facilities')return ['lot','garage','facility_unspecified']
    .reduce((sum,x)=>sum+(c.byType[x]||0),0)
  if(mode==='street')return c.byType.street_segment||0
  if(mode==='restricted')return c.restricted
  return 0
}
const esc=(x)=>String(x).replaceAll('&','&amp;')
  .replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
export function buildResearchHeatmap(coverage) {
  if(coverage?.schemaVersion!==1||!Array.isArray(coverage.grid?.cells)||
     !integer(coverage.counts?.insideNcr)||coverage.counts?.publicationApproved!==0||
     coverage.counts?.physicallyVerified!==0)
    throw new Error('Expected unapproved, unverified NCR coverage snapshot.')
  const cells=coverage.grid.cells
  if(!cells.length||cells.length>10000)throw new Error('Unexpected grid size.')
  const valid=cells.every(c=>validBox(c.bbox)&&integer(c.mappedEntities)&&
    integer(c.restricted)&&integer(c.accessUnknown)&&c.restricted<=c.mappedEntities&&
    c.accessUnknown<=c.mappedEntities&&c.byType&&
    ['lot','garage','facility_unspecified','street_segment'].every(k=>
      c.byType[k]===undefined||integer(c.byType[k]))&&
    count(c,'facilities')<=c.mappedEntities&&count(c,'street')<=c.mappedEntities)
  if(!valid||cells.reduce((s,c)=>s+c.mappedEntities,0)!==coverage.counts.insideNcr)
    throw new Error('Grid/source totals invalid; refusing misleading visualization.')
  const w=Math.min(...cells.map(c=>c.bbox[0])),e=Math.max(...cells.map(c=>c.bbox[2]))
  const s=Math.min(...cells.map(c=>c.bbox[1])),n=Math.max(...cells.map(c=>c.bbox[3]))
  const W=900,H=700;
  const toX=lon=>(lon-w)/(e-w)*W,toY=lat=>(n-lat)/(n-s)*H
  const rects=cells.map((c,i)=>{
    const [a,b,d,f]=c.bbox
    const [x,y,ww,hh]=[toX(a),toY(f),toX(d)-toX(a),toY(b)-toY(f)]
    return '<rect tabindex="0" role="button" aria-label="Grid cell '+(i+1)+'"'+
      ' x="'+x.toFixed(3)+'" y="'+y.toFixed(3)+
      '" width="'+ww.toFixed(3)+'" height="'+hh.toFixed(3)+'"'+
      ' data-mapped="'+c.mappedEntities+'" data-facilities="'+count(c,'facilities')+
      '" data-street="'+count(c,'street')+'" data-restricted="'+c.restricted+
      '" data-unknown="'+c.accessUnknown+'" data-coord="'+esc(c.researchCell||'')+
      '"><title>Mapped research observations: '+c.mappedEntities+
      ' (not available parking spaces)</title></rect>'
  }).join('\n')
  const totals={
    mapped:coverage.counts.insideNcr,
    facilities:cells.reduce((s,c)=>s+count(c,'facilities'),0),
    street:cells.reduce((s,c)=>s+count(c,'street'),0),
    restricted:cells.reduce((s,c)=>s+c.restricted,0),
  }
  const byModeMax={
    mapped:maxValue(cells,'mapped'),
    facilities:maxValue(cells,'facilities'),
    street:maxValue(cells,'street'),
    restricted:maxValue(cells,'restricted'),
  }
  // Numbers are encoded as literal data; no external maps, scripts, user notes or URLs.
  const js='const peak='+JSON.stringify(byModeMax)+';const total='+JSON.stringify(totals)+';'+
    'const el=[...document.querySelectorAll("rect[data-mapped]")];'+
    'const select=document.getElementById("mode");'+
    'const details=document.getElementById("details");'+
    'function color(v,m){if(!v)return "#e5e7eb";'+
    'const k=Math.min(1,Math.log(1+v)/Math.log(1+peak[m]));'+
    'return "hsl(209 72% "+(85-54*k)+"%)"}'+
    'function render(){const mode=select.value;'+
    'el.forEach(r=>r.setAttribute("fill",color(Number(r.dataset[mode]),mode)));'+
    'document.getElementById("stat").textContent=total[mode].toLocaleString()+" mapped "+'+
    '({mapped:"observations",facilities:"facility observations",street:"street segments",restricted:"restricted observations"}[mode]);'+
    '}'+
    'function inspect(r){details.textContent="Research grid "+r.dataset.coord+': '+
    '"+ "+r.dataset.mapped+" mapped observations; "+r.dataset.facilities+" facility observations; "+r.dataset.street+" street segments; "+r.dataset.restricted+" tagged restricted; "+r.dataset.unknown+" access unknown. NOT a count of available parking spaces.";}'+
    'el.forEach(r=>{r.addEventListener("click",()=>inspect(r));r.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();inspect(r)}})});'+
    'select.addEventListener("change",render);render();'
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>Parkey NCR internal mapped-supply research</title>'+
    '<style>body{font:16px/1.45 system-ui,sans-serif;max-width:1160px;'+
    'margin:0 auto;padding:24px;background:#f9fafb;color:#17202d}h1{margin:0}'+
    '.warning{background:#fff5e7;border:2px solid #9a6800;padding:16px;'+
    'border-radius:12px;margin:16px 0;font-weight:600}'+
    '.layout{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:18px}'+
    '.plot{border:1px solid #a7b0bd;background:#eef3f8;width:100%;'+
    'max-height:75vh}rect{stroke:#748093;stroke-width:.25;cursor:pointer}'+
    'rect:hover,rect:focus{stroke:#d4423a;stroke-width:2;outline:none}'+
    'aside{background:#fff;border:1px solid #ddd;padding:14px;border-radius:10px}'+
    'select{font:inherit;padding:8px;max-width:100%}small{color:#4b5563}'+
    '@media(max-width:750px){.layout{grid-template-columns:1fr}}'+
    '</style></head><body><h1>Parkey · NCR research overview</h1>'+
    '<p class="warning" role="status">INTERNAL RESEARCH ONLY — all records unverified and unapproved. '+
    'These are mapping observations, NOT available spaces, legal curb parking, verified visitor access, or navigation entrances. '+
    'Do not share this as a public parking finder.</p>'+
    '<div class="layout"><main><svg class="plot" viewBox="0 0 '+W+' '+H+
    '" role="img" aria-label="Geographic grid showing mapped source density across Metro Manila. '+ 
    'No confirmed available parking.">'+rects+'</svg></main>'+
    '<aside><label for="mode"><strong>Research metric</strong></label><p><select id="mode">'+
    '<option value="mapped">All source observations</option>'+
    '<option value="facilities">Facility source observations</option>'+
    '<option value="street">Street segments — legality unknown</option>'+
    '<option value="restricted">Mapped restricted-access features</option>'+
    '</select></p><p id="stat"></p><p id="details" aria-live="polite">Select a cell to inspect aggregated research counts.</p>'+
    '<hr><small>Source: NCR research snapshot; © OpenStreetMap contributors; Overture Maps Foundation. '+
    'Cells may overlap LGU borders. No basemap, remote requests, individual pins, routes or occupancy data. '+
    'Darkness reflects source observations, not parking demand or capacity.</small></aside></div>'+
    '<script>'+js+'</script></body></html>'
}
function cli(){
  const [input,output,...rest]=process.argv.slice(2)
  if(!input||!output||rest.length)throw new Error(
    'Usage: node scripts/ncr-research-preview.mjs data/ncr-research/coverage.json output/ncr/research-preview.html')
  const coverage=JSON.parse(readFileSync(input,'utf8'))
  const html=buildResearchHeatmap(coverage)
  mkdirSync(dirname(output),{recursive:true})
  writeFileSync(output,html,{flag:'wx'})
  process.stdout.write('Wrote local-only, aggregate NCR research preview: '+output+'\n')
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{cli()}catch(e){process.stderr.write(e.message+'\n');process.exitCode=1}
}
