import { createContext, useContext } from 'react'
import { useRouter } from 'expo-router'

// Discovery retains its map and navigation session beneath a full-page setting.
// Other routes use the same canonical Appearance screen through Expo Router.
export const AppearanceNavigation = createContext<(() => void) | null>(null)

export function useOpenAppearance() {
  const open = useContext(AppearanceNavigation)
  const router = useRouter()
  return open ?? (() => router.push('/appearance'))
}
