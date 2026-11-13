import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

import { layout, spacing } from '../theme'

export function ScreenContainer({
  backgroundColor,
  children,
  contentStyle,
  overlay,
}: {
  backgroundColor: string
  children: ReactNode
  contentStyle?: StyleProp<ViewStyle>
  overlay?: ReactNode
}) {
  const insets = useSafeAreaInsets()
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor }]}>
      <StatusBar style="light" />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, contentStyle]}>{children}</View>
      </ScrollView>
      {overlay ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.overlay,
            { top: insets.top, left: insets.left, right: insets.right },
          ]}
        >
          {overlay}
        </View>
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.screen,
  },
  overlay: { position: 'absolute', alignItems: 'flex-end' },
})
