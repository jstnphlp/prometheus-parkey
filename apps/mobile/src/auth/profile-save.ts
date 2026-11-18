import type { SupabaseClient, User } from '@supabase/supabase-js'

import {
  needsProfileName,
  profileComplete,
  profileFromUser,
  profileMetadata,
} from '../onboarding/profile.ts'
import type { ProfileDraft } from '../onboarding/profile.ts'

export async function saveAccountProfile(
  auth: Pick<SupabaseClient['auth'], 'getUser' | 'updateUser'>,
  userId: string,
  draft: ProfileDraft,
) {
  const verified = await auth.getUser()
  if (verified.error) throw verified.error
  const user = verified.data.user
  if (user?.id !== userId || !user.email_confirmed_at)
    throw new Error('Sign in again to save your profile.')
  // Keep the name already submitted during email registration.
  const data = profileMetadata(
    needsProfileName(user)
      ? draft
      : {
          ...draft,
          fullName: profileFromUser(user).fullName,
        },
  )
  const saved = await auth.updateUser({ data })
  if (saved.error) throw saved.error
  const confirmed = saved.data.user
  if (!confirmed || !profileSaveConfirmed(confirmed, userId, data))
    throw new Error('Your profile save could not be confirmed. Please retry.')
  return data
}

export function profileSaveConfirmed(
  user: User,
  userId: string,
  expected: ReturnType<typeof profileMetadata>,
) {
  return (
    user.id === userId &&
    Boolean(user.email_confirmed_at) &&
    profileComplete(user) &&
    JSON.stringify(profileMetadata(profileFromUser(user))) ===
      JSON.stringify(expected)
  )
}
