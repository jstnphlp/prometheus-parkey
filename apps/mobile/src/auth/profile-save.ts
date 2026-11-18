import type { SupabaseClient } from '@supabase/supabase-js'

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
  if (saved.data.user?.id !== userId || !profileComplete(saved.data.user))
    throw new Error('Your profile save could not be confirmed. Please retry.')
}
