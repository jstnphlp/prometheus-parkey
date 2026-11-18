import { StyleSheet, Text, View } from 'react-native'

import { createThemedStyles } from '../theme-provider'
import { FigmaAsset } from './figma-assets'
import type { FigmaAssetName } from './figma-assets'
import { Button, useUI } from './ui'

export function StateCard({
  icon = 'info-brand',
  title,
  body,
  action,
  onAction,
}: {
  icon?: FigmaAssetName
  title: string
  body: string
  action: string
  onAction: () => void
}) {
  const ui = useUI()
  const styles = useStyles()

  return (
    <View style={styles.card}>
      <View style={styles.message} accessibilityLiveRegion="polite">
        <View style={styles.badge}>
          <FigmaAsset name={icon} size={22} />
        </View>
        <View style={ui.flex}>
          <Text accessibilityRole="header" style={ui.heading}>
            {title}
          </Text>
          <Text style={ui.small}>{body}</Text>
        </View>
      </View>
      <Button onPress={onAction}>{action}</Button>
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    card: { gap: 12, width: '100%' },
    message: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    badge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.selected,
    },
  }),
)
