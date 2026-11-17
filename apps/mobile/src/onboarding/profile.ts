import type { User } from '@supabase/supabase-js'

export const profileChoices = {
  ageRange: ['Under 18', '18–24', '25–34', '35–44', '45–54', '55–64', '65+'],
  vehicleType: [
    'Motorcycle',
    'Sedan / Hatchback',
    'SUV / Crossover',
    'Pickup Truck',
    'Van / MPV',
    'Other',
  ],
  drivingFrequency: ['Daily', 'Weekly', 'Occasionally'],
  parkingDuration: ['Under 1 hour', '1–4 hours', '4+ hours'],
  parkingPreferences: [
    'Covered parking',
    '24-hour access',
    'EV charging',
    'Accessibility (PWD)',
  ],
  work: [
    'Office employee',
    'Self-employed',
    'Business owner',
    'Freelancer',
    'Student',
    'Retired',
    'Other',
  ],
  city: [
    'Caloocan City',
    'Las Piñas City',
    'Makati City',
    'Malabon City',
    'Mandaluyong City',
    'Manila',
    'Marikina City',
    'Muntinlupa City',
    'Navotas City',
    'Parañaque City',
    'Pasay City',
    'Pasig City',
    'Pateros',
    'Quezon City',
    'San Juan City',
    'Taguig City',
    'Valenzuela City',
    'Other',
  ],
  drivingPurpose: [
    'Work / Commuting',
    'School / University',
    'Business / Deliveries',
    'Errands / Shopping',
    'Leisure / Personal',
    'Other',
  ],
} as const

export type ProfileDraft = {
  fullName: string
  ageRange: string
  vehicleTypes: string[]
  work: string
  workOther: string
  city: string
  cityOther: string
  drivingPurpose: string
  drivingPurposeOther: string
  drivingFrequency: string
  parkingDuration: string
  parkingPreferences: string[]
}

const validText = (value: string) =>
  value.trim().length >= 2 && value.trim().length <= 100
const chosen = (values: readonly string[], value: string) =>
  values.includes(value.trim())

export type AboutField = 'work' | 'city' | 'drivingPurpose'
export function otherField(key: AboutField) {
  return `${key}Other` as const
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function profileStepProblem(
  draft: ProfileDraft,
  step: number,
): string | null {
  switch (step) {
    case 0:
      if (!validText(draft.fullName))
        return 'Enter your full name (2–100 characters).'
      return chosen(profileChoices.ageRange, draft.ageRange)
        ? null
        : 'Choose your age range.'
    case 1:
      return Array.isArray(draft.vehicleTypes) &&
        draft.vehicleTypes.length > 0 &&
        draft.vehicleTypes.every((value) =>
          chosen(profileChoices.vehicleType, value),
        )
        ? null
        : 'Choose at least one vehicle type.'
    case 2:
      return (['work', 'city', 'drivingPurpose'] as const).every(
        (key) =>
          chosen(profileChoices[key], draft[key]) &&
          (draft[key] !== 'Other' || validText(draft[otherField(key)])),
      )
        ? null
        : 'Choose an answer for all three questions. If you choose Other, enter 2–100 characters.'
    case 3:
      return chosen(profileChoices.drivingFrequency, draft.drivingFrequency) &&
        chosen(profileChoices.parkingDuration, draft.parkingDuration)
        ? null
        : 'Choose your driving frequency and parking duration.'
    case 4:
      return draft.parkingPreferences.length > 0 &&
        draft.parkingPreferences.every((value) =>
          chosen(profileChoices.parkingPreferences, value),
        )
        ? null
        : 'Choose at least one parking preference.'
    default:
      return 'Unknown setup step.'
  }
}

export function profileFromUser(user: User | null): ProfileDraft {
  const metadata: Record<string, unknown> = user?.user_metadata ?? {}
  const value = metadata.parkey_profile
  const saved = isRecord(value) ? value : {}
  const read = (key: string) =>
    typeof saved[key] === 'string' ? saved[key] : ''
  const readArray = (key: string) =>
    Array.isArray(saved[key])
      ? saved[key].filter((item): item is string => typeof item === 'string')
      : []
  const selection = (key: AboutField) => {
    const text = read(key).trim()
    return !text || chosen(profileChoices[key], text) ? text : 'Other'
  }
  const custom = (key: AboutField) =>
    selection(key) === 'Other'
      ? read(otherField(key)) || (read(key) !== 'Other' ? read(key) : '')
      : ''
  return {
    fullName: typeof metadata.full_name === 'string' ? metadata.full_name : '',
    ageRange: read('ageRange'),
    vehicleTypes: Array.isArray(saved.vehicleTypes)
      ? readArray('vehicleTypes')
      : read('vehicleType')
        ? [read('vehicleType')]
        : [],
    work: selection('work'),
    workOther: custom('work'),
    city: selection('city'),
    cityOther: custom('city'),
    drivingPurpose: selection('drivingPurpose'),
    drivingPurposeOther: custom('drivingPurpose'),
    drivingFrequency: read('drivingFrequency'),
    parkingDuration: read('parkingDuration'),
    parkingPreferences: readArray('parkingPreferences'),
  }
}

export function needsProfileName(user: User) {
  return (
    user.app_metadata.provider !== 'email' ||
    !validText(profileFromUser(user).fullName)
  )
}

export function profileComplete(user: User) {
  const draft = profileFromUser(user)
  return [0, 1, 2, 3, 4].every((step) => !profileStepProblem(draft, step))
}

export function profileMetadata(draft: ProfileDraft) {
  for (let step = 0; step < 5; step++) {
    const problem = profileStepProblem(draft, step)
    if (problem) throw new Error(problem)
  }
  const { fullName, ...profile } = draft
  return {
    full_name: fullName.trim(),
    parkey_profile: {
      ...profile,
      vehicleTypes: [...new Set(profile.vehicleTypes)],
      work: profile.work.trim(),
      city: profile.city.trim(),
      drivingPurpose: profile.drivingPurpose.trim(),
      workOther: profile.work === 'Other' ? profile.workOther.trim() : '',
      cityOther: profile.city === 'Other' ? profile.cityOther.trim() : '',
      drivingPurposeOther:
        profile.drivingPurpose === 'Other'
          ? profile.drivingPurposeOther.trim()
          : '',
      parkingPreferences: [...new Set(profile.parkingPreferences)],
    },
  }
}
