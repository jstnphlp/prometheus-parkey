import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Explore from '../discovery/explore'
import { colors } from '../discovery/palette'
import { pilotDiscoveryEnabled } from '../discovery/pilot-config'
import PilotDiscovery from '../discovery/pilot-discovery'

export default function MainDiscovery() {
  const [legacy, setLegacy] = useState(false)
  const insets = useSafeAreaInsets()
  const legacyAllowed = process.env.NODE_ENV === 'development'
  if (!pilotDiscoveryEnabled) return <Explore />
  if (!legacy || !legacyAllowed)
    return (
      <PilotDiscovery
        allowLegacy={legacyAllowed}
        onOpenLegacy={() => {
          if (legacyAllowed) setLegacy(true)
        }}
      />
    )
  return (
    <View style={styles.screen}>
      <Explore />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Return to pilot cities"
        onPress={() => setLegacy(false)}
        style={[styles.return, { top: insets.top + 4 }]}
      >
        <Text style={styles.label}>Pilot cities</Text>
      </Pressable>
    </View>
  )
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  return: {
    position: 'absolute',
    alignSelf: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.brand, fontWeight: '600' },
})
