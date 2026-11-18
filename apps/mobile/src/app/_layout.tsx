import { useEffect, useRef, useState } from 'react'
import { useFonts } from 'expo-font'
import { Stack, usePathname } from 'expo-router'
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
import { useReducedMotion } from '../discovery/use-reduced-motion'
import { walkthroughTransitionDuration } from '../onboarding/walkthrough-motion-state'
import { WalkthroughMotionProvider } from '../onboarding/walkthrough-motion'
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
              <WalkthroughMotionProvider>
                <RootNavigator />
              </WalkthroughMotionProvider>
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
  const { completed, loadState } = useOnboarding()
  const pathname = usePathname()
  const [contentReady, setContentReady] = useState(false)
  const splashHidden = useRef(false)
  const reducedMotion = useReducedMotion()
  useEffect(initializeTelemetry, [])
  const onboardingTransition = {
    animation: reducedMotion ? 'none' : 'fade_from_bottom',
    animationDuration: walkthroughTransitionDuration,
    animationMatchesGesture: true,
  } as const

  useEffect(() => {
    if (!contentReady || splashHidden.current) return
    // The index redirect has no content to reveal on a fresh install.
    if (loadState !== 'error' && pathname === '/' && !completed) return
    splashHidden.current = true
    NativeSplash.setOptions({ fade: !reducedMotion, duration: 180 })
    NativeSplash.hide()
  }, [completed, contentReady, loadState, pathname, reducedMotion])

  if ((!fontsLoaded && !fontError) || loadState === 'loading' || !theme.ready)
    return <SplashScreen />
  if (loadState === 'error')
    return (
      <View style={styles.screen} onLayout={() => setContentReady(true)}>
        <StorageRecovery />
      </View>
    )

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.tokens.canvas }]}
      onLayout={() => setContentReady(true)}
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
            animation: 'none',
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
