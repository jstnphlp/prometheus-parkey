export const onboardingStorageKey = 'parkey:onboarding:v1'

type OnboardingStorage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<unknown>
}

// Separate from discovery data: completing onboarding never resets saved parking.
export function createOnboardingStore(storage: OnboardingStorage) {
  return {
    async read(): Promise<boolean> {
      return (await storage.getItem(onboardingStorageKey)) === 'complete'
    },
    async complete(): Promise<void> {
      await storage.setItem(onboardingStorageKey, 'complete')
    },
  }
}
