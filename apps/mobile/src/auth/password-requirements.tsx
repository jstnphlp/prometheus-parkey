import { StyleSheet, Text, View } from 'react-native'

import { useTheme, createThemedStyles } from '../theme-provider'
import { BrandIcon } from '../components/brand-icon'
import { typography } from '../theme'
import { passwordRequirements } from './validation'

export function PasswordRequirements({ password }: { password: string }) {
  const { entryColors: colors } = useTheme()
  const styles = useStyles()

  return (
    <View style={styles.list}>
      <Text style={styles.heading}>Password requirements</Text>
      {passwordRequirements(password).map(({ label, met }) => (
        <View
          key={label}
          accessible
          accessibilityLabel={`${met ? 'Met' : 'Not met'}: ${label}`}
          style={styles.row}
        >
          <View style={styles.marker}>
            {met ? (
              <BrandIcon name="check" size={16} color={colors.white} />
            ) : (
              <View style={styles.dot} />
            )}
          </View>
          <Text accessible={false} style={styles.text}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  )
}

const useStyles = createThemedStyles(({ entryColors: colors }) =>
  StyleSheet.create({
    list: { paddingVertical: 8, gap: 4 },
    heading: { ...typography.accountBody, color: colors.text, marginBottom: 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    marker: {
      width: 16,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.card },
    text: { ...typography.accountBody, color: colors.text, flex: 1 },
  }),
)
