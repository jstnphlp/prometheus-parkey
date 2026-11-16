import { useLocalSearchParams } from 'expo-router'

import { SettingsDetailScreen } from '../../settings/settings-screen'

export default function SettingsDetailRoute() {
  const { section } = useLocalSearchParams<{ section: string }>()
  return <SettingsDetailScreen section={section} />
}
