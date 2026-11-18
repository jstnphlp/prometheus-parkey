export const walkthroughTransitionDuration = 300

export function createWalkthroughMotion() {
  let activeStep = 0
  let advanceAt = 0
  return {
    focus(step: number, reduced: boolean): number {
      const previous = activeStep
      activeStep = step
      if (step < previous) advanceAt = 0
      return reduced || previous === 0 || step === 0 ? step : previous
    },
    claimAdvance(now: number, reduced: boolean): boolean {
      if (!reduced && now < advanceAt) return false
      // Suppress touches that land on a new route during the stack handoff.
      advanceAt = reduced ? now : now + walkthroughTransitionDuration
      return true
    },
  }
}
