import assert from 'node:assert/strict'
import test from 'node:test'

import {
  profileFromUser,
  profileMetadata,
  profileStepProblem,
} from './profile.ts'

test('vehicle setup accepts multiple selected categories and requires at least one', () => {
  const draft = profileFromUser(null)
  draft.fullName = 'Test Driver'
  draft.vehicleTypes = ['Motorcycle', 'SUV / Crossover']
  assert.equal(profileStepProblem(draft, 0), null)
  assert.ok(profileStepProblem({ ...draft, vehicleTypes: [] }, 0))
  assert.ok(profileStepProblem({ ...draft, vehicleTypes: ['invalid'] }, 0))
})

test('About You requires dropdown values and an explanation only when Other is selected', () => {
  const draft = {
    ...profileFromUser(null),
    work: 'Office employee',
    city: 'Taguig City',
    drivingPurpose: 'Work / Commuting',
  }
  assert.equal(profileStepProblem(draft, 1), null)
  assert.ok(profileStepProblem({ ...draft, work: 'arbitrary free text' }, 1))
  assert.ok(profileStepProblem({ ...draft, work: 'Other' }, 1))
  assert.equal(
    profileStepProblem(
      { ...draft, work: 'Other', workOther: 'Custom occupation' },
      1,
    ),
    null,
  )
})

test('existing single-vehicle and custom-text profiles restore without losing answers', () => {
  const draft = profileFromUser({
    user_metadata: {
      full_name: 'Test Driver',
      parkey_profile: {
        vehicleType: 'Motorcycle',
        work: 'Custom occupation',
        city: 'Taguig City',
        drivingPurpose: 'Work / Commuting',
      },
    },
  })
  assert.deepEqual(draft.vehicleTypes, ['Motorcycle'])
  assert.equal(draft.work, 'Other')
  assert.equal(draft.workOther, 'Custom occupation')
})

test('saving clears hidden Other text and preserves all selected vehicles', () => {
  const draft = {
    ...profileFromUser(null),
    fullName: 'Test Driver',
    vehicleTypes: ['Motorcycle', 'SUV / Crossover'],
    work: 'Office employee',
    workOther: 'stale text',
    city: 'Taguig City',
    drivingPurpose: 'Work / Commuting',
    drivingFrequency: 'Daily',
    parkingDuration: '1–4 hours',
    parkingPreferences: ['Covered parking'],
  }
  const saved = profileMetadata(draft)
  assert.deepEqual(saved.parkey_profile.vehicleTypes, draft.vehicleTypes)
  assert.equal(saved.parkey_profile.workOther, '')
})
