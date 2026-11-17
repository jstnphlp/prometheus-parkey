import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'

import { useArchitectureInsets } from '../components/architecture-page'
import { BrandLogo } from '../components/brand-logo'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { Button, IconButton, ParkingPinIcon } from './ui'

function LocationPreview({ denied }: { denied: boolean }) {
  const styles = useStyles()
  const { colors } = useTheme()
  return (
    <View
      accessible={false}
      style={[styles.preview, denied && { height: 268 }]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 330 236"
        preserveAspectRatio="none"
      >
        <Rect width={330} height={236} rx={22} fill={colors.soft} />
        {[10, 120, 230].map((x) =>
          [12, 132].map((y) => (
            <Rect
              key={`${x}:${y}`}
              x={x}
              y={y}
              width={77}
              height={86}
              rx={12}
              fill={colors.border}
            />
          )),
        )}
        <Path
          d="M106 0v236M216 0v236M0 106h330"
          stroke={colors.canvas}
          strokeWidth={26}
        />
      </Svg>
      <View style={[styles.previewPin, { left: 145, top: 48 }]}>
        <ParkingPinIcon size={39} />
      </View>
      <View style={[styles.previewPin, { left: 38, top: 155 }]}>
        <ParkingPinIcon size={39} />
      </View>
      <View style={[styles.previewPin, { right: 30, top: 155 }]}>
        <ParkingPinIcon size={39} />
      </View>
      <View style={styles.previewLabel}>
        <Text style={styles.previewText}>MAP ILLUSTRATION</Text>
      </View>
    </View>
  )
}

export function LocationPage({
  status,
  onBack,
  onLocate,
  onSearch,
  onWebSettings,
}: {
  status: 'idle' | 'locating' | 'denied' | 'error'
  onBack: () => void
  onLocate: () => void
  onSearch: () => void
  onWebSettings: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const insets = useArchitectureInsets()
  const { height } = useWindowDimensions()
  const denied = status === 'denied' || status === 'error'
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            minHeight: height,
            paddingTop: insets.top + (denied ? 6 : 39),
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        {denied ? (
          <IconButton
            icon="back"
            label="Back"
            color={colors.back}
            onPress={onBack}
            style={styles.back}
          />
        ) : (
          <BrandLogo variant="account" style={{ width: 42, height: 47 }} />
        )}
        <Text
          accessibilityRole="header"
          style={[styles.title, { marginTop: denied ? 40 : 76 }]}
        >
          {denied ? 'Location access\nis off' : 'Find parking\nnear you'}
        </Text>
        <Text style={[styles.body, { marginTop: denied ? 20 : 44 }]}>
          {denied
            ? 'You can still search for parking without sharing your precise location.'
            : 'Allow location access to show nearby parking, or search a destination manually.'}
        </Text>
        <View style={{ marginTop: denied ? 28 : 58 }}>
          <LocationPreview denied={denied} />
        </View>
        <Text style={styles.note}>
          {denied
            ? status === 'error'
              ? 'Your location could not be found. Check location access and try again.'
              : 'Location permission can be changed in your device settings.'
            : 'Illustrative locations, not live availability'}
        </Text>
        <View style={styles.actions}>
          <Button
            disabled={status === 'locating'}
            onPress={denied ? onSearch : onLocate}
          >
            {denied
              ? 'Search a Destination'
              : status === 'locating'
                ? 'Finding your location…'
                : 'Use Current Location'}
          </Button>
          <Pressable
            accessibilityRole="button"
            onPress={
              denied
                ? () => {
                    if (Platform.OS === 'web') onWebSettings()
                    else void Linking.openSettings().catch(onWebSettings)
                  }
                : onSearch
            }
            style={styles.link}
          >
            <Text style={styles.linkText}>
              {denied ? 'Open Device Settings' : 'Enter a destination instead'}
            </Text>
          </Pressable>
          {denied ? (
            <Pressable
              accessibilityRole="button"
              onPress={onLocate}
              style={styles.link}
            >
              <Text style={styles.body}>Try location again</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvas },
    content: {
      flexGrow: 1,
      paddingHorizontal: 28,
      width: '100%',
      maxWidth: 540,
      alignSelf: 'center',
    },
    back: {
      marginLeft: -13,
      width: 48,
      height: 48,
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: 36,
      lineHeight: 44,
      color: colors.ink,
    },
    body: {
      fontFamily: fonts.medium,
      fontSize: 16,
      lineHeight: 21,
      color: colors.muted,
    },
    preview: {
      height: 236,
      width: '100%',
      maxWidth: 330,
      alignSelf: 'center',
      borderRadius: 22,
      overflow: 'hidden',
    },
    previewPin: { position: 'absolute' },
    previewLabel: {
      position: 'absolute',
      left: 12,
      top: 12,
      backgroundColor: colors.canvas,
      borderRadius: 13,
      padding: 12,
    },
    previewText: {
      fontFamily: fonts.semibold,
      fontSize: 10,
      lineHeight: 14,
      color: colors.ink,
    },
    note: {
      fontFamily: fonts.medium,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
      textAlign: 'center',
      marginTop: 36,
      marginBottom: 44,
      paddingHorizontal: 12,
    },
    actions: { marginTop: 'auto' },
    link: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    linkText: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 21,
      color: colors.navigationActive,
    },
  }),
)
