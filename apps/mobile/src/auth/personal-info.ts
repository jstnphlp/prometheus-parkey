import type { SupabaseClient, User } from '@supabase/supabase-js'

import { profileChoices, profileFromUser } from '../onboarding/profile.ts'
import type { ProfileDraft } from '../onboarding/profile.ts'

export type PersonalInfoDraft = Pick<
  ProfileDraft,
  'fullName' | 'ageRange' | 'city' | 'cityOther' | 'work' | 'workOther'
>

export function personalInfoFromUser(user: User | null): PersonalInfoDraft {
  const { fullName, ageRange, city, cityOther, work, workOther } =
    profileFromUser(user)
  return { fullName, ageRange, city, cityOther, work, workOther }
}

export function personalInfoProblem(draft: PersonalInfoDraft) {
  const validText = (value: string) =>
    value.trim().length >= 2 && value.trim().length <= 100
  if (!validText(draft.fullName))
    return 'Enter your full name (2–100 characters).'
  if (!profileChoices.ageRange.some((value) => value === draft.ageRange))
    return 'Choose your age range.'
  for (const field of ['city', 'work'] as const) {
    if (!profileChoices[field].some((value) => value === draft[field]))
      return field === 'city' ? 'Choose your city.' : 'Choose your occupation.'
    if (
      draft[field] === 'Other' &&
      !validText(draft[field === 'city' ? 'cityOther' : 'workOther'])
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
  const current: unknown = user.user_metadata.parkey_profile
  const existing =
    typeof current === 'object' && current !== null && !Array.isArray(current)
      ? current
      : {}
  const { fullName, ...fields } = draft
  const normalized = {
    ...fields,
    cityOther: draft.city === 'Other' ? draft.cityOther.trim() : '',
    workOther: draft.work === 'Other' ? draft.workOther.trim() : '',
  }
  const result = await auth.updateUser({
    data: {
      full_name: fullName.trim(),
      parkey_profile: { ...existing, ...normalized },
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
