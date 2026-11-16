import type { ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { createThemedStyles } from '../theme-provider'
import { IconButton, useUI } from './ui'
import { useReducedMotion } from './use-reduced-motion'

export function ModalSheet({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ui = useUI()
  const styles = useStyles()

  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()
  return (
    <Modal
      transparent
      animationType={reduced ? 'none' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close panel"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.modal,
            { paddingBottom: Math.max(insets.bottom, 20), maxHeight: '90%' },
          ]}
        >
          <View style={styles.grip} />
          <View style={[ui.row, styles.header]}>
            <Text accessibilityRole="header" style={[ui.sectionTitle, ui.flex]}>
              {title}
            </Text>
            <IconButton
              icon="close"
              label={`Close ${title}`}
              onPress={onClose}
            />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.backdrop,
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
      overflow: 'hidden',
    },
    grip: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.disabledSurface,
      marginTop: 12,
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 24,
    },
  }),
)
