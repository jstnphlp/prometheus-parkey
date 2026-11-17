import assert from 'node:assert/strict'
import test from 'node:test'

import {
  needsProfileName,
  profileComplete,
  profileFromUser,
  profileMetadata,
  profileStepProblem,
} from './profile.ts'

const draft = {
  fullName: 'Test Driver',
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

test('every setup field is required before completion', () => {
  for (const key of Object.keys(draft).filter(
    (key) => !key.endsWith('Other'),
  )) {
    const incomplete = { ...draft, [key]: Array.isArray(draft[key]) ? [] : '' }
    assert.throws(() => profileMetadata(incomplete), undefined, key)
    assert.equal(
      profileComplete({
        user_metadata: {
          full_name: incomplete.fullName,
          parkey_profile: incomplete,
        },
      }),
      false,
      key,
    )
  }
  for (let step = 0; step < 5; step++)
    assert.equal(profileStepProblem(draft, step), null)
})

test('email signup reuses its name; OAuth can set a name and legacy email accounts can recover', () => {
  const user = {
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Registered Driver' },
  }
  assert.equal(needsProfileName(user), false)
  assert.equal(profileFromUser(user).fullName, 'Registered Driver')
  assert.equal(
    needsProfileName({ ...user, app_metadata: { provider: 'google' } }),
    true,
  )
  assert.equal(needsProfileName({ ...user, user_metadata: {} }), true)
})

test('unknown choices, whitespace, and oversized free text cannot complete setup', () => {
  for (const key of ['ageRange', 'drivingFrequency', 'parkingDuration'])
    assert.throws(() => profileMetadata({ ...draft, [key]: 'invalid' }))
  for (const key of ['fullName', 'work', 'city', 'drivingPurpose'])
    for (const value of ['   ', 'x'.repeat(101)])
      assert.throws(() => profileMetadata({ ...draft, [key]: value }))
  assert.throws(() =>
    profileMetadata({ ...draft, parkingPreferences: ['invalid'] }),
  )
})

test('saved account metadata restores a complete profile without mutating the draft', () => {
  const metadata = profileMetadata({
    ...draft,
    fullName: '  Test Driver  ',
    city: '  Taguig City  ',
  })
  const user = { user_metadata: metadata }
  assert.equal(profileComplete(user), true)
  assert.deepEqual(profileFromUser(user), draft)
  assert.equal(draft.city, 'Taguig City')
  assert.equal(
    profileComplete({
      user_metadata: { parkey_profile: { parkingPreferences: [null, 4] } },
    }),
    false,
  )
})
