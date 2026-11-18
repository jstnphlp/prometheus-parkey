import type { User } from '@supabase/supabase-js'

export const profileChoices = {
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

export const validProfileText = (value: string) =>
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

export const profileStepCount = 4

export type ProfileIssue = {
  field: keyof ProfileDraft
  message: string
}

export function profileStepIssue(
  draft: ProfileDraft,
  step: number,
): ProfileIssue | null {
  switch (step) {
    case 0:
      if (!validProfileText(draft.fullName))
        return {
          field: 'fullName',
          message: 'Enter your full name (2–100 characters).',
        }
      return draft.vehicleTypes.length > 0 &&
        draft.vehicleTypes.every((value) =>
          chosen(profileChoices.vehicleType, value),
        )
        ? null
        : {
            field: 'vehicleTypes',
            message: 'Choose at least one vehicle type.',
          }
    case 1:
      for (const [key, label] of [
        ['work', 'your occupation'],
        ['city', 'your city of residence'],
        ['drivingPurpose', 'what you usually drive for'],
      ] as const) {
        if (!chosen(profileChoices[key], draft[key]))
          return { field: key, message: 'Choose ' + label + '.' }
        if (
          draft[key].trim() === 'Other' &&
          !validProfileText(draft[otherField(key)])
        )
          return {
            field: otherField(key),
            message: 'Enter 2–100 characters for Other.',
          }
      }
      return null
    case 2:
      if (!chosen(profileChoices.drivingFrequency, draft.drivingFrequency))
        return {
          field: 'drivingFrequency',
          message: 'Choose how often you drive.',
        }
      return chosen(profileChoices.parkingDuration, draft.parkingDuration)
        ? null
        : {
            field: 'parkingDuration',
            message: 'Choose how long you usually park.',
          }
    case 3:
      return draft.parkingPreferences.length > 0 &&
        draft.parkingPreferences.every((value) =>
          chosen(profileChoices.parkingPreferences, value),
        )
        ? null
        : {
            field: 'parkingPreferences',
            message: 'Choose at least one parking preference.',
          }
    default:
      return { field: 'fullName', message: 'Unknown setup step.' }
  }
}

export function profileStepProblem(draft: ProfileDraft, step: number) {
  return profileStepIssue(draft, step)?.message ?? null
}

export function firstIncompleteProfileStep(draft: ProfileDraft): number | null {
  for (let step = 0; step < profileStepCount; step++) {
    if (profileStepIssue(draft, step)) return step
  }
  return null
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
    if (!text || chosen(profileChoices[key], text)) return text
    // Older metadata stored custom text directly. Invalid modern enums are incomplete.
    return Object.hasOwn(saved, otherField(key)) ? '' : 'Other'
  }
  const custom = (key: AboutField) =>
    selection(key) === 'Other'
      ? read(otherField(key)) || (read(key) !== 'Other' ? read(key) : '')
      : ''
  const fullName = [metadata.full_name, metadata.name].find(
    (name): name is string =>
      typeof name === 'string' && validProfileText(name),
  )
  return {
    fullName: fullName?.trim() ?? '',
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
  return !validProfileText(profileFromUser(user).fullName)
}

export function profileComplete(user: User) {
  return firstIncompleteProfileStep(profileFromUser(user)) === null
}

/** Write only supported survey fields, including when editing a partial legacy profile. */
export function profileSurveyFields(draft: ProfileDraft) {
  const selection = (
    key: AboutField | 'drivingFrequency' | 'parkingDuration',
  ) => (chosen(profileChoices[key], draft[key]) ? draft[key].trim() : '')
  const custom = (key: AboutField) =>
    selection(key) === 'Other' && validProfileText(draft[otherField(key)])
      ? draft[otherField(key)].trim()
      : ''
  const selections = (options: readonly string[], values: string[]) => [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter((value) => options.includes(value)),
    ),
  ]
  return {
    vehicleTypes: selections(profileChoices.vehicleType, draft.vehicleTypes),
    work: selection('work'),
    workOther: custom('work'),
    city: selection('city'),
    cityOther: custom('city'),
    drivingPurpose: selection('drivingPurpose'),
    drivingPurposeOther: custom('drivingPurpose'),
    drivingFrequency: selection('drivingFrequency'),
    parkingDuration: selection('parkingDuration'),
    parkingPreferences: selections(
      profileChoices.parkingPreferences,
      draft.parkingPreferences,
    ),
  }
}

export function profileMetadata(draft: ProfileDraft) {
  const incomplete = firstIncompleteProfileStep(draft)
  if (incomplete !== null)
    throw new Error(
      profileStepProblem(draft, incomplete) ?? 'Complete your profile.',
    )
  return {
    full_name: draft.fullName.trim(),
    parkey_profile: profileSurveyFields(draft),
  }
}
