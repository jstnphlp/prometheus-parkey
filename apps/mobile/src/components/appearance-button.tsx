import { IconButton } from '../discovery/ui'
import { useOpenAppearance } from './appearance-navigation'

export function AppearanceButton() {
  const open = useOpenAppearance()
  return <IconButton icon="appearance" label="Appearance" onPress={open} />
}
