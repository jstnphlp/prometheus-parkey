import type { Coordinate, DiscoveryParking } from '@parkey/shared-types'

import { anchor, distanceMeters, kindLabels } from './model.ts'
import { spotHours } from './spot-hours.ts'
import { parkingFee } from './parking-fee.ts'
import type { WeekDay } from './spot-hours.ts'
import { reviewedParkingEntrance } from './parking-navigation.ts'

export type ParkingDetailRow = {
  icon: 'clock' | 'fees' | 'access' | 'list'
  label: string
  value: string
  url?: string
  today?: boolean
}
export type SpotDetails = {
  title: string
  meta: string
  chips: string[]
  warning?: string
  week?: WeekDay[]
  rows: ParkingDetailRow[]
  updated?: string
  verification: string
  sourceDate: string
  freshness?: string
  geometryNote: string
  sparse: boolean
  fee?: string
  access?: string
  capacity?: number
  maxStay?: string | undefined
  heightLimit?: string | undefined
  parkingType?: string | undefined
  covered?: string | undefined
  lit?: string | undefined
  supervised?: string | undefined
  surface?: string | undefined
  wheelchair?: string | undefined
  checkDate?: string | undefined
  accessibleSpaces?: number | undefined
  chargingSpaces?: number | undefined
  paymentMethods: string[]
  vehicles: { motorcar?: string | undefined; motorcycle?: string | undefined }
  operator?: string | undefined
  phone?: string
  website?: string
  photo?: {
    image?: string | undefined
    commons?: string | undefined
    mapillary?: string | undefined
  }
}
function text(value: string | null | undefined): string | undefined {
  const result = value?.trim()
  return !result ||
    /\b(?:unknown|unavailable|not recorded)\b|^(?:n\/a|none|-)$/i.test(result)
    ? undefined
    : result
}
export function detailDistance(meters: number): string | undefined {
  if (!Number.isFinite(meters) || meters > 100000 || meters < 0)
    return undefined
  if (meters < 1000)
    return `${(Math.round(meters / 10) * 10).toLocaleString('en-US')} m`
  return `${(meters / 1000).toLocaleString('en-US', { minimumFractionDigits: meters < 10000 ? 1 : 0, maximumFractionDigits: meters < 10000 ? 1 : 0 })} km`
}
export function parkingDestination(
  parking: DiscoveryParking,
  _origin: Coordinate | null,
  now = Date.now(),
): Coordinate | null {
  return reviewedParkingEntrance(parking, now)
}
export function parkingDetailData(
  parking: DiscoveryParking,
  location: Coordinate | null,
  now = new Date(),
): SpotDetails {
  const tags = parking.osmTags ?? {}
  const get = (key: string) => text(tags[key])
  const named = text(get('name') ?? parking.name)
  const realName = named && !/^Unnamed\b/i.test(named) ? named : undefined
  const street =
    get('addr:street') ?? (parking.kind === 'street' ? realName : undefined)
  const title =
    realName ?? (street ? `Street parking on ${street}` : 'Parking lot')
  const fees = text(parking.fees)
  const charge = get('charge')
  const fee = parkingFee(parking)
  const hours = spotHours(
    get('opening_hours') ?? text(parking.hours),
    anchor(parking.geometry),
    now,
  )
  const count = (key: string) => {
    const value = get(key)
    return value && /^\d+$/.test(value) ? Number(value) : undefined
  }
  const capacity = count('capacity')
  const access =
    get('access') ??
    parking.regulations
      .find((r) =>
        /^Access (?:recorded by OpenStreetMap:|:)\s*/i.test(r.description),
      )
      ?.description.replace(/^Access (?:recorded by OpenStreetMap:|:)\s*/i, '')
  const warning =
    access &&
    /^(customers|private|permit|no|destination|delivery)$/i.test(access)
      ? {
          customers: 'Customers only',
          private: 'Private parking',
          permit: 'Permit required',
          no: 'No public access',
          destination: 'Destination access only',
          delivery: 'Deliveries only',
        }[access.toLowerCase()]
      : undefined
  const rows: ParkingDetailRow[] = []
  const add = (
    label: string,
    value: string | undefined,
    icon: ParkingDetailRow['icon'] = 'list',
    url?: string,
  ) => {
    if (value) rows.push({ label, value, icon, ...(url ? { url } : {}) })
  }
  for (const day of hours.week ?? [])
    rows.push({
      label: day.day,
      value: `${day.day} · ${day.hours}`,
      icon: 'clock',
      today: day.today,
    })
  add(
    'Fee',
    fee === 'Free'
      ? 'Source records no fee; check posted signs'
      : (charge ?? fees ?? fee),
    'fees',
  )
  const payments = Object.entries(tags)
    .filter(([key, value]) => key.startsWith('payment:') && value === 'yes')
    .map(([key]) => key.slice(8).replaceAll('_', ' '))
  add('Payment', payments.length ? payments.join(', ') : undefined, 'fees')
  add(
    'Maximum stay',
    get('maxstay') ??
      text(
        parking.regulations
          .find((r) => /^Maximum stay:/i.test(r.description))
          ?.description.replace(/^Maximum stay:\s*/i, ''),
      ),
  )
  add(
    'Spaces',
    capacity === undefined
      ? undefined
      : `${capacity.toLocaleString('en-US')} spaces`,
  )
  const disabled = count('capacity:disabled')
  add(
    'Accessible spaces',
    disabled === undefined ? undefined : `${disabled} accessible spaces`,
  )
  add('Access', access?.replaceAll('_', ' '), 'access')
  add(
    'Vehicles',
    ['motorcar', 'motorcycle']
      .filter((key) => get(key))
      .map(
        (key) =>
          `${key === 'motorcar' ? 'Cars' : 'Motorcycles'}: ${get(key)?.replaceAll('_', ' ')}`,
      )
      .join(' · ') || undefined,
  )
  add('Height limit', get('maxheight'))
  add('Type', get('parking')?.replaceAll('_', ' '))
  for (const [key, label] of [
    ['covered', 'Covered'],
    ['lit', 'Lit'],
    ['supervised', 'Supervised'],
  ] as const)
    add(
      label,
      get(key) ? `${label}: ${get(key)?.replaceAll('_', ' ')}` : undefined,
    )
  const ev = count('capacity:charging')
  add('EV charging', ev === undefined ? undefined : `${ev} EV charging spaces`)
  add('Operator', get('operator'))
  const phone = get('phone')
  add(
    'Phone',
    phone,
    'list',
    phone && /^\+?[\d\s()-]+$/.test(phone)
      ? `tel:${phone.replaceAll(/[^+\d]/g, '')}`
      : undefined,
  )
  const website = get('website')
  add(
    'Website',
    website,
    'list',
    website && /^https?:\/\//i.test(website) ? website : undefined,
  )
  for (const rule of parking.regulations) {
    if (rule.sourceLabel === 'Parkey import geometry note') continue
    const value = text(rule.description)?.replace(
      ' recorded by OpenStreetMap',
      '',
    )
    if (
      value &&
      !rows.some((row) => row.value === value) &&
      !/^(Access|Maximum stay):/i.test(value)
    )
      add('Restrictions', value)
  }
  const edited = parking.osmEditedAt
  const updated =
    edited && Number.isFinite(Date.parse(edited))
      ? `OSM edited ${new Date(edited).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`
      : undefined
  const sourceTime = Date.parse(parking.sourceUpdatedAt ?? '')
  const sourceDate = Number.isFinite(sourceTime)
    ? `${parking.sourceKind === 'osm' ? 'Snapshot imported' : 'Source recorded'} ${new Date(sourceTime).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Manila' })}`
    : 'Source date unknown'
  const freshness =
    Number.isFinite(sourceTime) && now.getTime() - sourceTime > 30 * 86400000
      ? 'Source information is over 30 days old. Check current signs and access.'
      : edited &&
          Number.isFinite(Date.parse(edited)) &&
          now.getTime() - Date.parse(edited) > 365 * 86400000
        ? 'OSM record last edited over a year ago. Current conditions are unconfirmed.'
        : undefined
  const verification =
    parking.sourceKind === 'sample'
      ? 'Development sample'
      : parking.verification === 'verified'
        ? `Verified ${new Date(parking.verifiedAt ?? '').toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Manila' })}`
        : 'Not field verified'
  const geometryNote = reviewedParkingEntrance(parking, now.getTime())
    ? 'Reviewed vehicle entrance. Confirm current access on arrival.'
    : parking.kind === 'street'
      ? 'Mapped street extent. Navigation requires a reviewed vehicle entrance; check signs and parking restrictions.'
      : parking.entrances?.length
        ? 'Mapped entrance. Vehicle access is unverified; navigation is unavailable.'
        : 'Entrance not mapped. Navigation requires reviewed entrance and visitor access.'
  const distance = location
    ? detailDistance(distanceMeters(location, anchor(parking.geometry)))
    : undefined
  const type = kindLabels[parking.kind]
  return {
    verification,
    sourceDate,
    geometryNote,
    ...(freshness ? { freshness } : {}),
    maxStay: get('maxstay'),
    heightLimit: get('maxheight'),
    parkingType: get('parking'),
    covered: get('covered'),
    lit: get('lit'),
    supervised: get('supervised'),
    surface: get('surface'),
    wheelchair: get('wheelchair'),
    checkDate: get('check_date'),
    accessibleSpaces: disabled,
    chargingSpaces: ev,
    paymentMethods: payments,
    vehicles: { motorcar: get('motorcar'), motorcycle: get('motorcycle') },
    title,
    meta: [
      title.toLowerCase() !== type.toLowerCase() &&
      !title.startsWith('Street parking on ')
        ? type
        : undefined,
      distance,
    ]
      .filter(Boolean)
      .join(' · '),
    chips: [
      fee,
      hours.summary,
      capacity === undefined
        ? undefined
        : `${capacity.toLocaleString('en-US')} spaces`,
    ]
      .filter((v): v is string => !!v)
      .slice(0, 3),
    ...(warning ? { warning } : {}),
    ...(hours.week ? { week: hours.week } : {}),
    rows,
    ...(updated ? { updated } : {}),
    sparse: !rows.length,
    ...(fee ? { fee } : {}),
    ...(access ? { access } : {}),
    ...(capacity === undefined ? {} : { capacity }),
    ...(get('operator') ? { operator: get('operator') } : {}),
    ...(phone ? { phone } : {}),
    ...(website ? { website } : {}),
    photo: {
      image: get('image'),
      commons: get('wikimedia_commons'),
      mapillary: get('mapillary'),
    },
  }
}
