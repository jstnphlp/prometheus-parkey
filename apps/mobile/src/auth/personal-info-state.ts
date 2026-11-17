import type { User } from '@supabase/supabase-js'

import { personalInfoFromUser } from './personal-info.ts'
import type { PersonalInfoDraft } from './personal-info.ts'
import type { AuthSnapshot } from './session.ts'

export type PersonalInfoEditorState = {
  userId: string | null
  draft: PersonalInfoDraft
  editing: boolean
  error: string | null
}

export function personalInfoEditor(user: User | null): PersonalInfoEditorState {
  return {
    userId: user?.id ?? null,
    draft: personalInfoFromUser(user),
    editing: false,
    error: null,
  }
}

export function reconcilePersonalInfoEditor(
  editor: PersonalInfoEditorState,
  auth: AuthSnapshot,
) {
  // A failed refresh is not a sign-out. The screen hides private fields while
  // identity is unverified, but keeps the draft available for a successful retry.
  if (auth.status === 'checking' || auth.status === 'error') return editor
  const user = auth.status === 'signed-in' ? auth.user : null
  return editor.userId === (user?.id ?? null)
    ? editor
    : personalInfoEditor(user)
}
