import { StyleSheet, Text, View } from 'react-native'

import { BrandIcon } from '../components/brand-icon'
import { colors, typography } from '../theme'

import { passwordRequirements } from './validation'

export function PasswordRequirements({ password }: { password: string }) {
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

const styles = StyleSheet.create({
  list: { paddingVertical: 8, gap: 4 },
  heading: { ...typography.accountBody, color: colors.white, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marker: {
    width: 16,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.white },
  text: { ...typography.accountBody, color: colors.white, flex: 1 },
})
