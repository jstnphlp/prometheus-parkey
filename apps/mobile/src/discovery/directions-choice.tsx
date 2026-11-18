import { Pressable, StyleSheet, Text, View } from 'react-native'

import { AppearanceButton } from '../components/appearance-button'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { MotionView } from './motion'
import { IconButton } from './ui'

export function DirectionsChoice({
  top,
  bottom,
  busy,
  onBack,
  onChoose,
}: {
  top: number
  bottom: number
  busy: boolean
  onBack: () => void
  onChoose: (provider: 'google' | 'waze' | 'parkey') => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  return (
    <>
      <MotionView
        fromOpacity={0.8}
        distance={4}
        style={[styles.header, { paddingTop: top + 6 }]}
      >
        <IconButton
          icon="back"
          label="Back from directions"
          color={colors.back}
          onPress={onBack}
          style={styles.back}
        />
        <Text accessibilityRole="header" style={styles.title}>
          Get Direction
        </Text>
        <AppearanceButton />
      </MotionView>
      <MotionView
        fromOpacity={0.8}
        distance={6}
        testID="directions-choice"
        style={[styles.footer, { paddingBottom: bottom + 8 }]}
      >
        <Text style={styles.caption}>Choose how to navigate</Text>
        <View style={styles.choices}>
          {(['google', 'waze', 'parkey'] as const).map((provider) => (
            <Pressable
              key={provider}
              accessibilityRole="button"
              accessibilityLabel={`Navigate with ${provider === 'google' ? 'Google Maps' : provider === 'waze' ? 'Waze' : 'Parkey'}`}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => onChoose(provider)}
              style={[
                styles.choice,
                provider === 'parkey' && { backgroundColor: colors.brand },
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  provider === 'parkey' && { color: colors.onAction },
                ]}
              >
                {provider === 'google'
                  ? 'Google'
                  : provider === 'waze'
                    ? 'Waze'
                    : 'Parkey'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.note}>
          Google/Waze open externally · Parkey uses in-app guidance
        </Text>
      </MotionView>
    </>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: colors.canvas,
      paddingHorizontal: 15,
      paddingBottom: 20,
    },
    back: { width: 48, height: 48, backgroundColor: 'transparent' },
    title: {
      flex: 1,
      fontFamily: fonts.bold,
      fontSize: 26,
      lineHeight: 34,
      color: colors.ink,
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.canvas,
      paddingHorizontal: 25,
      paddingTop: 18,
      gap: 12,
    },
    caption: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
      textAlign: 'center',
    },
    choices: { flexDirection: 'row', gap: 11 },
    choice: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    choiceText: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      lineHeight: 20,
      color: colors.ink,
    },
    note: {
      fontFamily: fonts.medium,
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
      textAlign: 'center',
    },
  }),
)
