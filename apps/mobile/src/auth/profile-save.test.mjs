import assert from 'node:assert/strict'
import test from 'node:test'

import { saveAccountProfile } from './profile-save.ts'

const user = {
  id: 'fixture-driver',
  email_confirmed_at: '2026-11-18T00:00:00Z',
  app_metadata: { provider: 'email' },
  user_metadata: { full_name: 'Registered Driver' },
}
const draft = {
  fullName: 'New Name',
  ageRange: '25–34',
  vehicleTypes: ['Motorcycle'],
  work: 'Office employee',
  workOther: '',
  cityOther: '',
  drivingPurposeOther: '',
  city: 'Taguig City',
  drivingPurpose: 'Work / Commuting',
  drivingFrequency: 'Daily',
  parkingDuration: '1–4 hours',
  parkingPreferences: ['Covered parking'],
}

test('saving verifies the account and reuses the email registration name', async () => {
  let data
  await saveAccountProfile(
    {
      getUser: async () => ({ data: { user }, error: null }),
      updateUser: async (input) => {
        data = input.data
        return {
          data: {
            user: {
              ...user,
              user_metadata: { ...user.user_metadata, ...data },
            },
          },
          error: null,
        }
      },
    },
    user.id,
    draft,
  )
  assert.equal(data.full_name, 'Registered Driver')
  assert.equal(data.parkey_profile.city, draft.city)
  assert.equal(draft.fullName, 'New Name')
})

test('OAuth saves the entered name; invalid answers never call updateUser', async () => {
  const oauth = { ...user, app_metadata: { provider: 'google' } }
  let calls = 0
  const auth = {
    getUser: async () => ({ data: { user: oauth }, error: null }),
    updateUser: async ({ data }) => {
      calls++
      assert.equal(data.full_name, 'New Name')
      return { data: { user: { ...oauth, user_metadata: data } }, error: null }
    },
  }
  await assert.rejects(
    saveAccountProfile(auth, user.id, { ...draft, ageRange: '' }),
  )
  assert.equal(calls, 0)
  await saveAccountProfile(auth, user.id, draft)
  assert.equal(calls, 1)
})

test('save failure rejects and the same draft can be retried successfully', async () => {
  let failed = true
  const auth = {
    getUser: async () => ({ data: { user }, error: null }),
    updateUser: async ({ data }) =>
      failed
        ? { data: { user: null }, error: new Error('offline') }
        : { data: { user: { ...user, user_metadata: data } }, error: null },
  }
  await assert.rejects(saveAccountProfile(auth, user.id, draft), /offline/)
  failed = false
  await saveAccountProfile(auth, user.id, draft)
})

test('missing, changed, unconfirmed, or failed sessions cannot save', async () => {
  for (const result of [
    { data: { user: null }, error: null },
    { data: { user: { ...user, id: 'another-account' } }, error: null },
    { data: { user: { ...user, email_confirmed_at: null } }, error: null },
    { data: { user }, error: new Error('verification failed') },
  ]) {
    await assert.rejects(
      saveAccountProfile(
        {
          getUser: async () => result,
          updateUser: async () => assert.fail('must not save'),
        },
        user.id,
        draft,
      ),
    )
  }
})

test('a missing or incomplete server response never reports success', async () => {
  for (const saved of [null, user, { ...user, id: 'another-account' }])
    await assert.rejects(
      saveAccountProfile(
        {
          getUser: async () => ({ data: { user }, error: null }),
          updateUser: async () => ({ data: { user: saved }, error: null }),
        },
        user.id,
        draft,
      ),
    )
})
