import assert from 'node:assert/strict'
import test from 'node:test'

import { personalInfoFromUser, savePersonalInfo } from './personal-info.ts'

const user = {
  id: 'driver',
  email: 'driver@example.invalid',
  email_confirmed_at: '2026-11-18T00:00:00Z',
  user_metadata: {
    full_name: 'Registered Driver',
    another_preference: true,
    parkey_profile: {
      vehicleTypes: ['Sedan / Hatchback', 'Motorcycle'],
      drivingFrequency: 'Daily',
      parkingPreferences: ['Covered parking'],
      future_field: 'preserve',
      ageRange: '25–34',
    },
  },
}
const draft = {
  fullName: ' Updated Driver ',
  city: 'Taguig City',
  cityOther: 'stale hidden city',
  work: 'Other',
  workOther: ' Consultant ',
}

test('personal edits update the name and preserve fresh server questionnaire answers', async () => {
  let submitted
  const auth = {
    getUser: async () => ({ data: { user }, error: null }),
    updateUser: async (attributes) => {
      submitted = attributes
      return {
        data: {
          user: {
            ...user,
            user_metadata: { ...user.user_metadata, ...attributes.data },
          },
        },
        error: null,
      }
    },
  }
  await savePersonalInfo(auth, user.id, draft)
  assert.deepEqual(Object.keys(submitted), ['data'])
  assert.deepEqual(Object.keys(submitted.data).sort(), [
    'full_name',
    'parkey_profile',
  ])
  assert.equal(submitted.data.full_name, 'Updated Driver')
  assert.equal(submitted.data.parkey_profile.cityOther, '')
  assert.equal(submitted.data.parkey_profile.workOther, 'Consultant')
  for (const [key, value] of Object.entries(
    user.user_metadata.parkey_profile,
  ).filter(([field]) => field !== 'ageRange'))
    assert.deepEqual(submitted.data.parkey_profile[key], value)
  assert.equal('ageRange' in submitted.data.parkey_profile, false)
  assert.equal(draft.fullName, ' Updated Driver ')
})

test('missing and invalid personal answers cannot send an update', async () => {
  for (const patch of [
    { fullName: ' ' },
    { fullName: 'x'.repeat(101) },
    { city: 'Unknown' },
    { city: 'Other', cityOther: '' },
    { work: 'Unknown' },
    { workOther: ' ' },
  ]) {
    await assert.rejects(
      savePersonalInfo(
        {
          getUser: async () => ({ data: { user }, error: null }),
          updateUser: async () =>
            assert.fail('invalid answers must not be saved'),
        },
        user.id,
        { ...draft, ...patch },
      ),
    )
  }
})

test('personal updates require the same confirmed server-verified account', async () => {
  for (const result of [
    { data: { user: null }, error: null },
    { data: { user: { ...user, id: 'another-driver' } }, error: null },
    { data: { user: { ...user, email_confirmed_at: null } }, error: null },
    { data: { user }, error: new Error('offline') },
  ]) {
    await assert.rejects(
      savePersonalInfo(
        {
          getUser: async () => result,
          updateUser: async () =>
            assert.fail('unverified account must not be updated'),
        },
        user.id,
        draft,
      ),
    )
  }
})

test('a rejected write or unconfirmed server response never reports success', async () => {
  for (const result of [
    { data: { user: null }, error: new Error('offline') },
    { data: { user: null }, error: null },
    { data: { user }, error: null },
    { data: { user: { ...user, id: 'another-driver' } }, error: null },
  ]) {
    await assert.rejects(
      savePersonalInfo(
        {
          getUser: async () => ({ data: { user }, error: null }),
          updateUser: async () => result,
        },
        user.id,
        draft,
      ),
    )
  }
})

test('saved Other answers restore for editing without exposing unrelated metadata', () => {
  assert.deepEqual(
    personalInfoFromUser({
      ...user,
      user_metadata: {
        ...user.user_metadata,
        parkey_profile: {
          ...user.user_metadata.parkey_profile,
          city: 'Other',
          cityOther: 'Custom city',
          work: 'Other',
          workOther: 'Consultant',
        },
      },
    }),
    {
      fullName: 'Registered Driver',
      city: 'Other',
      cityOther: 'Custom city',
      work: 'Other',
      workOther: 'Consultant',
    },
  )
})
