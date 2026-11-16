import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as NativeSplash from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider } from '../auth/provider'
import { PopupProvider } from '../components/popup-provider'
import { initializeTelemetry } from '../discovery/telemetry'
import { OnboardingProvider, useOnboarding } from '../onboarding/provider'
import { SplashScreen } from '../onboarding/splash-screen'
import { StorageRecovery } from '../onboarding/storage-recovery'
import { useReducedMotion } from '../onboarding/use-reduced-motion'
import { fontSources } from '../theme'
import { ThemeProvider, useTheme } from '../theme-provider'

// Keep the native brand screen visible while fonts and local progress load.
void NativeSplash.preventAutoHideAsync()

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <OnboardingProvider>
          <AuthProvider>
            <PopupProvider>
              <RootNavigator />
            </PopupProvider>
          </AuthProvider>
        </OnboardingProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

function RootNavigator() {
  const theme = useTheme()
  const [fontsLoaded, fontError] = useFonts(fontSources)
  const { loadState } = useOnboarding()
  const reducedMotion = useReducedMotion()
  useEffect(initializeTelemetry, [])
  const onboardingTransition = {
    animation: reducedMotion ? 'fade' : 'slide_from_right',
    animationMatchesGesture: true,
  } as const

  function hideSplash() {
    NativeSplash.setOptions({ fade: !reducedMotion, duration: 200 })
    NativeSplash.hide()
  }

  if ((!fontsLoaded && !fontError) || loadState === 'loading' || !theme.ready)
    return <SplashScreen />
  if (loadState === 'error')
    return (
      <View style={styles.screen} onLayout={hideSplash}>
        <StorageRecovery />
      </View>
    )

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.tokens.canvas }]}
      onLayout={hideSplash}
    >
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.tokens.canvas },
          animation: reducedMotion ? 'none' : 'default',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="welcome"
          options={{
            animation: 'fade',
            contentStyle: { backgroundColor: theme.tokens.canvas },
          }}
        />
        <Stack.Screen
          name="onboarding/discover"
          options={{
            ...onboardingTransition,
            contentStyle: { backgroundColor: theme.tokens.canvas },
          }}
        />
        <Stack.Screen
          name="onboarding/compare"
          options={{
            ...onboardingTransition,
            contentStyle: { backgroundColor: theme.tokens.canvas },
          }}
        />
        <Stack.Screen
          name="onboarding/navigate"
          options={{
            ...onboardingTransition,
            contentStyle: { backgroundColor: theme.tokens.canvas },
          }}
        />
        <Stack.Screen
          name="reset-password"
          options={{ gestureEnabled: false }}
        />
      </Stack>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
})
