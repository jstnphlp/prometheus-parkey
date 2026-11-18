import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createWalkthroughMotion,
  walkthroughTransitionDuration,
} from './walkthrough-motion-state.ts'

test('walkthrough progress follows the previous focused step in either direction', () => {
  const motion = createWalkthroughMotion()
  assert.equal(motion.focus(1, false), 1)
  assert.equal(motion.focus(2, false), 1)
  assert.equal(motion.focus(3, false), 2)
  assert.equal(motion.focus(2, false), 3)
  assert.equal(motion.focus(0, false), 0)
  assert.equal(motion.focus(1, false), 1)
})

test('rapid taps cannot advance a second route during the same transition', () => {
  const motion = createWalkthroughMotion()
  motion.focus(1, false)
  assert.equal(motion.claimAdvance(1000, false), true)
  motion.focus(2, false)
  assert.equal(
    motion.claimAdvance(1000 + walkthroughTransitionDuration - 1, false),
    false,
  )
  assert.equal(
    motion.claimAdvance(1000 + walkthroughTransitionDuration, false),
    true,
  )
})

test('Back releases the pending advance and reduced motion settles immediately', () => {
  const motion = createWalkthroughMotion()
  motion.focus(1, false)
  assert.equal(motion.claimAdvance(1000, false), true)
  motion.focus(2, false)
  assert.equal(motion.focus(1, false), 2)
  assert.equal(motion.claimAdvance(1100, false), true)
  assert.equal(motion.focus(2, true), 2)
  assert.equal(motion.claimAdvance(1101, true), true)
  assert.equal(motion.focus(3, true), 3)
})
