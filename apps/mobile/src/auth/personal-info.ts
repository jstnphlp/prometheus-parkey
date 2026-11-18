import type { SupabaseClient, User } from '@supabase/supabase-js'

import {
  profileChoices,
  profileFromUser,
  profileSurveyFields,
  validProfileText,
} from '../onboarding/profile.ts'
import type { ProfileDraft } from '../onboarding/profile.ts'

export type PersonalInfoDraft = Pick<
  ProfileDraft,
  'fullName' | 'city' | 'cityOther' | 'work' | 'workOther'
>

export function personalInfoFromUser(user: User | null): PersonalInfoDraft {
  const { fullName, city, cityOther, work, workOther } = profileFromUser(user)
  return { fullName, city, cityOther, work, workOther }
}

export function personalInfoProblem(draft: PersonalInfoDraft) {
  if (!validProfileText(draft.fullName))
    return 'Enter your full name (2–100 characters).'
  for (const field of ['city', 'work'] as const) {
    if (!profileChoices[field].some((value) => value === draft[field]))
      return field === 'city' ? 'Choose your city.' : 'Choose your occupation.'
    if (
      draft[field] === 'Other' &&
      !validProfileText(draft[field === 'city' ? 'cityOther' : 'workOther'])
    )
      return field === 'city'
        ? 'Enter your city (2–100 characters).'
        : 'Enter your occupation (2–100 characters).'
  }
  return null
}

export async function savePersonalInfo(
  auth: Pick<SupabaseClient['auth'], 'getUser' | 'updateUser'>,
  userId: string,
  draft: PersonalInfoDraft,
) {
  const problem = personalInfoProblem(draft)
  if (problem) throw new Error(problem)
  const verified = await auth.getUser()
  if (verified.error) throw verified.error
  const user = verified.data.user
  if (user?.id !== userId || !user.email_confirmed_at)
    throw new Error('Sign in again to update your personal info.')
  const stored: unknown = user.user_metadata.parkey_profile
  // Retain unrelated metadata from the latest verified profile while retiring
  // legacy keys whose values are represented by the active survey fields.
  const unrelated =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? Object.fromEntries(
          Object.entries(stored).filter(
            ([key]) => key !== 'ageRange' && key !== 'vehicleType',
          ),
        )
      : {}
  const { fullName, city, work } = draft
  const normalized = {
    city,
    work,
    cityOther: draft.city === 'Other' ? draft.cityOther.trim() : '',
    workOther: draft.work === 'Other' ? draft.workOther.trim() : '',
  }
  const result = await auth.updateUser({
    data: {
      full_name: fullName.trim(),
      parkey_profile: {
        ...unrelated,
        ...profileSurveyFields({ ...profileFromUser(user), ...normalized }),
      },
    },
  })
  if (result.error) throw result.error
  const saved = result.data.user
  if (saved?.id !== userId || !saved.email_confirmed_at)
    throw new Error('Your changes could not be confirmed. Please retry.')
  const confirmed = personalInfoFromUser(saved)
  const expected = { fullName: fullName.trim(), ...normalized }
  if (
    !(Object.keys(expected) as (keyof PersonalInfoDraft)[]).every(
      (key) => confirmed[key] === expected[key],
    )
  )
    throw new Error('Your changes could not be confirmed. Please retry.')
}
