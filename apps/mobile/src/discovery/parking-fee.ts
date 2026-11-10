import type { DiscoveryParking } from '@parkey/shared-types'

export type ParkingFeeStatus = 'free' | 'paid' | 'unknown'
export type ParkingFeeFacts = {
  status: ParkingFeeStatus
  value?: string
  conflict: boolean
  sources: { label: string; value: string }[]
}

function recorded(value: string | null | undefined) {
  const text = value?.trim()
  return text &&
    !/^(?:unknown|unavailable|not recorded|n\/a|none|-)$/i.test(text)
    ? text
    : undefined
}

function price(value: string | undefined): number | undefined {
  const amount =
    /^(?:PHP|₱)\s*(\d+(?:\.\d{1,2})?)(?:\s*(?:\/\s*|per\s+)(?:h|hr|hour|day))?$/i.exec(
      value ?? '',
    )
  const number = amount ? Number(amount[1]) : NaN
  return Number.isFinite(number) && number > 0 ? number : undefined
}

function assertion(value: string | undefined): ParkingFeeStatus {
  if (
    /^(?:free(?: parking)?|no (?:fee|charge)|OSM records no fee; check posted signs)$/i.test(
      value ?? '',
    )
  )
    return 'free'
  if (
    /^(?:paid(?: parking)?|fee applies(?:; amount unavailable)?)$/i.test(
      value ?? '',
    )
  )
    return 'paid'
  return price(value) !== undefined ? 'paid' : 'unknown'
}

function priceIdentity(value: string | undefined) {
  const amount = price(value)
  if (amount === undefined) return undefined
  const unit = /(?:\/\s*|per\s+)(h|hr|hour|day)$/i.exec(value ?? '')?.[1]
  return `${amount}:${unit ? (unit.toLowerCase() === 'day' ? 'day' : 'hour') : 'unspecified'}`
}

/** Conflicting source facts never become an unconditional free/paid assertion. */
export function parkingFeeFacts(parking: DiscoveryParking): ParkingFeeFacts {
  const tags = parking.osmTags ?? {}
  const tag = recorded(tags.fee)?.toLowerCase()
  const fees = recorded(parking.fees)
  const charge = recorded(tags.charge)
  const sources = [
    ...(tag ? [{ label: 'OSM fee', value: tags.fee?.trim() ?? tag }] : []),
    ...(charge ? [{ label: 'OSM charge', value: charge }] : []),
    ...(fees ? [{ label: 'Recorded fee', value: fees }] : []),
  ]
  const feeStatus = assertion(fees)
  const chargeStatus = assertion(charge)
  const free = tag === 'no' || feeStatus === 'free' || chargeStatus === 'free'
  const paid = tag === 'yes' || feeStatus === 'paid' || chargeStatus === 'paid'
  const conflict =
    (free && paid) ||
    (free && !!charge && chargeStatus !== 'free') ||
    (free && !!fees && feeStatus === 'unknown') ||
    (free && tag !== undefined && tag !== 'no' && tag !== 'yes') ||
    (priceIdentity(fees) !== undefined &&
      priceIdentity(charge) !== undefined &&
      priceIdentity(fees) !== priceIdentity(charge))
  if (conflict) return { status: 'unknown', conflict: true, sources }
  if (free) return { status: 'free', value: 'Free', conflict: false, sources }
  if (paid)
    return {
      status: 'paid',
      value:
        charge && chargeStatus === 'paid' && price(charge) !== undefined
          ? charge
          : fees && feeStatus === 'paid' && price(fees) !== undefined
            ? fees
            : 'Paid',
      conflict: false,
      sources,
    }
  return { status: 'unknown', conflict: false, sources }
}

/** Only consistent explicit source values establish a parking fee. */
export function parkingFee(parking: DiscoveryParking): string | undefined {
  return parkingFeeFacts(parking).value
}
