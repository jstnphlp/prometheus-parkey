import { Linking, Pressable, Text } from 'react-native'

import type { SearchCredit } from './place-search'
import { ui } from './ui'

export function SearchAttribution({
  credit,
}: {
  credit: SearchCredit | null | undefined
}) {
  if (!credit) return null
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={credit.label}
      onPress={() => void Linking.openURL(credit.url)}
      style={{ minHeight: 48, justifyContent: 'center' }}
    >
      <Text style={[ui.small, ui.link]}>{credit.label}</Text>
    </Pressable>
  )
}
