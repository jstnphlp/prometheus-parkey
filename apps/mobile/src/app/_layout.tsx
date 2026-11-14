import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as NativeSplash from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider } from '../auth/provider'
import { PopupProvider } from '../components/popup-provider'
import { initializeTelemetry } from '../discovery/telemetry'
import { fontSources } from '../discovery/typography'
import { OnboardingProvider, useOnboarding } from '../onboarding/provider'
import { SplashScreen } from '../onboarding/splash-screen'
import { StorageRecovery } from '../onboarding/storage-recovery'
import { useReducedMotion } from '../onboarding/use-reduced-motion'
import { fontSources as redesignFontSources } from '../theme'

const allFonts = { ...fontSources, ...redesignFontSources }

// Keep the native brand screen visible while fonts and local progress load.
void NativeSplash.preventAutoHideAsync()

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <OnboardingProvider>
        <AuthProvider>
          <PopupProvider>
            <RootNavigator />
          </PopupProvider>
        </AuthProvider>
      </OnboardingProvider>
    </SafeAreaProvider>
  )
}

function RootNavigator() {
  const [fontsLoaded, fontError] = useFonts(allFonts)
  const { loadState } = useOnboarding()
  const reducedMotion = useReducedMotion()
  useEffect(initializeTelemetry, [])
  useEffect(() => {
    if ((fontsLoaded || fontError) && loadState !== 'loading')
      NativeSplash.hide()
  }, [fontsLoaded, fontError, loadState])

  if ((!fontsLoaded && !fontError) || loadState === 'loading')
    return <SplashScreen />
  if (loadState === 'error') return <StorageRecovery />

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: reducedMotion ? 'none' : 'default',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="reset-password"
          options={{ gestureEnabled: false }}
        />
      </Stack>
    </>
  )
}
