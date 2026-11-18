import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import {
  ArchitecturePage,
  useArchitectureInsets,
} from '../components/architecture-page'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import type { DiscoveryFilter, FeeFilter, ParkingFeature } from './filters'
import { Button, Choice, Icon, useUI } from './ui'

const features = [
  ['covered', 'Covered parking'],
  ['24h', 'Open 24 hours'],
  ['ev', 'EV charging'],
  ['accessible', 'Accessibility (PWD)'],
] as const

export function ParkingFiltersPage({
  kind,
  fees,
  selectedFeatures,
  onBack,
  onApply,
}: {
  kind: DiscoveryFilter
  fees: FeeFilter
  selectedFeatures: ParkingFeature[]
  onBack: () => void
  onApply: (
    kind: DiscoveryFilter,
    fees: FeeFilter,
    features: ParkingFeature[],
  ) => void
}) {
  const styles = useStyles()
  const insets = useArchitectureInsets()
  const ui = useUI()
  const { colors } = useTheme()
  const [draftKind, setKind] = useState(kind)
  const [draftFees, setFees] = useState(fees)
  const [draftFeatures, setFeatures] = useState(selectedFeatures)
  return (
    <View style={{ flex: 1 }}>
      <ArchitecturePage
        title="Filter parking"
        subtitle="Choose what matters most to you."
        onBack={onBack}
      >
        <Text style={styles.label}>PARKING FEATURES</Text>
        <View style={styles.features}>
          {features.map(([id, title]) => {
            const checked = draftFeatures.includes(id)
            return (
              <Pressable
                key={id}
                accessibilityRole="checkbox"
                accessibilityLabel={title}
                accessibilityState={{ checked }}
                aria-checked={checked}
                onPress={() =>
                  setFeatures(
                    checked
                      ? draftFeatures.filter((feature) => feature !== id)
                      : [...draftFeatures, id],
                  )
                }
                style={styles.feature}
              >
                <Text style={styles.featureText}>{title}</Text>
                <View
                  style={[
                    styles.checkbox,
                    checked && {
                      backgroundColor: colors.brand,
                      borderColor: colors.brand,
                    },
                  ]}
                >
                  {checked ? (
                    <Icon name="check" size={19} color={colors.onAction} />
                  ) : null}
                </View>
              </Pressable>
            )
          })}
        </View>
        <Text style={styles.label}>PARKING TYPE</Text>
        <View style={styles.choices}>
          {(
            [
              ['all', 'Any'],
              ['garage', 'Garage'],
              ['lot', 'Open lot'],
              ['street', 'Street'],
            ] as const
          ).map(([id, title]) => (
            <Choice
              key={id}
              selected={draftKind === id}
              onPress={() => setKind(id)}
            >
              {title}
            </Choice>
          ))}
        </View>
        <Text style={styles.label}>RECORDED FEES</Text>
        <View style={styles.choices}>
          {(
            [
              ['all', 'Any'],
              ['free', 'No fee'],
              ['applies', 'Fee applies'],
            ] as const
          ).map(([id, title]) => (
            <Choice
              key={id}
              selected={draftFees === id}
              onPress={() => setFees(id)}
            >
              {title}
            </Choice>
          ))}
        </View>
        <Text style={[ui.small, { marginBottom: 24 }]}>
          Filters use recorded source facts. Locations with unknown features are
          excluded from selected feature filters.
        </Text>
        <View style={{ height: 130 }} />
      </ArchitecturePage>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <Button onPress={() => onApply(draftKind, draftFees, draftFeatures)}>
          Apply Filters
        </Button>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setKind('all')
            setFees('all')
            setFeatures([])
          }}
          style={styles.clear}
        >
          <Text style={[ui.link, styles.featureText]}>Clear All Filters</Text>
        </Pressable>
      </View>
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 28,
      paddingTop: 12,
      backgroundColor: colors.canvas,
    },
    label: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      lineHeight: 20,
      color: colors.ink,
      marginBottom: 16,
    },
    features: { gap: 12, marginBottom: 36 },
    feature: {
      minHeight: 68,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 18,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    featureText: {
      fontFamily: fonts.semibold,
      fontSize: 16,
      lineHeight: 24,
      color: colors.ink,
      flex: 1,
    },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    choices: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 24,
    },
    clear: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
    },
  }),
)
