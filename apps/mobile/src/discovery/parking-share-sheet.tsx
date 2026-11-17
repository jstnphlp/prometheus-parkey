import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { ModalSheet } from './sheets'
import { Icon } from './ui'

export function ParkingShareSheet({
  title,
  onClose,
  onShare,
  onCopy,
  feedback,
}: {
  title: string
  onClose: () => void
  onShare: () => void
  onCopy: () => void
  feedback: string | null
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const systemShare =
    Platform.OS !== 'web' || typeof navigator.share === 'function'
  return (
    <ModalSheet title="Share Parking Location" onClose={onClose} centeredHeader>
      <View style={styles.content}>
        <Text style={styles.caption}>{title}</Text>
        <View style={styles.targets}>
          {systemShare ? (
            <Pressable
              accessibilityRole="button"
              onPress={onShare}
              style={styles.target}
            >
              <View style={styles.badge}>
                <Icon name="share" size={27} color={colors.onAction} />
              </View>
              <Text style={styles.label}>Share…</Text>
            </Pressable>
          ) : null}
          {Platform.OS === 'web' ? (
            <Pressable
              accessibilityRole="button"
              onPress={onCopy}
              style={styles.target}
            >
              <View style={styles.badge}>
                <Icon name="link" size={27} color={colors.onAction} />
              </View>
              <Text style={styles.label}>Copy details</Text>
            </Pressable>
          ) : null}
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.caption}>
          {feedback ||
            'Parking information only. Availability and access are unconfirmed.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={styles.cancel}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </ModalSheet>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    content: { paddingHorizontal: 24, gap: 20 },
    caption: {
      fontFamily: fonts.medium,
      fontSize: 13,
      lineHeight: 19,
      color: colors.muted,
      textAlign: 'center',
    },
    targets: {
      minHeight: 120,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 40,
    },
    target: { alignItems: 'center', gap: 10, minWidth: 80 },
    badge: {
      width: 60,
      height: 60,
      borderRadius: 18,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontFamily: fonts.medium,
      fontSize: 12,
      lineHeight: 18,
      color: colors.ink,
    },
    cancel: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      lineHeight: 20,
      color: colors.navigationActive,
    },
  }),
)
