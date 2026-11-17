import assert from 'node:assert/strict'
import test from 'node:test'

import {
  personalInfoEditor,
  reconcilePersonalInfoEditor,
} from './personal-info-state.ts'

const user = { id: 'driver', user_metadata: { full_name: 'Registered Driver' } }
const signedIn = (value = user) => ({
  status: 'signed-in',
  user: value,
  expiresAt: Date.now() + 3600000,
})

test('unsaved personal edits survive checking, a transient error and verification of the same account', () => {
  const editor = {
    ...personalInfoEditor(user),
    editing: true,
    draft: { ...personalInfoEditor(user).draft, fullName: 'Unsaved Driver' },
  }
  let state = reconcilePersonalInfoEditor(editor, {
    status: 'checking',
    user: null,
  })
  state = reconcilePersonalInfoEditor(state, { status: 'error', user: null })
  state = reconcilePersonalInfoEditor(state, { status: 'checking', user: null })
  state = reconcilePersonalInfoEditor(
    state,
    signedIn({ ...user, user_metadata: { full_name: 'Server Driver' } }),
  )
  assert.equal(state.draft.fullName, 'Unsaved Driver')
  assert.equal(state.editing, true)
  assert.equal(state, editor)
})

test('a confirmed different account cannot inherit another account personal draft', () => {
  const editor = {
    ...personalInfoEditor(user),
    editing: true,
    error: 'Previous error',
  }
  const state = reconcilePersonalInfoEditor(
    editor,
    signedIn({
      id: 'another-driver',
      user_metadata: { full_name: 'Another Driver' },
    }),
  )
  assert.equal(state.userId, 'another-driver')
  assert.equal(state.draft.fullName, 'Another Driver')
  assert.equal(state.editing, false)
  assert.equal(state.error, null)
})

test('sign-out, recovery and unavailable authentication clear private edits', () => {
  for (const auth of [
    { status: 'signed-out', user: null },
    { status: 'unavailable', user: null },
    { status: 'recovery', user, expiresAt: Date.now() + 3600000 },
  ]) {
    const state = reconcilePersonalInfoEditor(
      { ...personalInfoEditor(user), editing: true },
      auth,
    )
    assert.equal(state.userId, null)
    assert.equal(state.draft.fullName, '')
    assert.equal(state.editing, false)
  }
})
