import { Link, Stack } from 'expo-router'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useState } from 'react'

const configuredUrl = process.env.EXPO_PUBLIC_RESEARCH_CONSOLE_URL || ''
const allowed =
  /^https:\/\/[^ /?#]+\.[^ /?#]+(?:\/[^?#]*)?$/.test(configuredUrl) ||
  (process.env.NODE_ENV === 'development' &&
    /^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/?$/.test(configuredUrl))

/** NCR source research now runs solely in a separate authenticated web app. */
export default function ResearchMoved() {
  const [failed, setFailed] = useState(false)
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Parkey Research Console' }} />
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          Research Console is now on the web
        </Text>
        <Text style={styles.body}>
          NCR parking-source research, annotations and reviewer moderation have
          moved to a separate authenticated web application. They are no longer
          displayed inside the Parkey customer mobile app.
        </Text>
        <Text style={styles.warning}>
          Research observations are unverified and are not available parking,
          legal visitor access, or navigation entrances.
        </Text>
        {allowed ? (
          <Pressable
            accessibilityRole="link"
            style={styles.button}
            onPress={() => {
              setFailed(false)
              void Linking.openURL(configuredUrl).catch(() => setFailed(true))
            }}
          >
            <Text style={styles.buttonText}>
              Open Research Console in browser
            </Text>
          </Pressable>
        ) : (
          <Text testID="research-console-not-configured" style={styles.body}>
            A hosted Research Console URL has not been configured yet.
          </Text>
        )}
        {failed ? (
          <Text role="alert" style={styles.warning}>
            Could not open the browser link.
          </Text>
        ) : null}
        <Link href="/" style={styles.back}>
          Return to Parkey mobile discovery
        </Link>
      </View>
    </View>
  )
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F7F8FB',
    justifyContent: 'center',
  },
  card: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 24,
    gap: 18,
  },
  title: { fontSize: 23, fontWeight: '700', color: '#182239' },
  body: { fontSize: 15, lineHeight: 23, color: '#50607A' },
  warning: { fontSize: 13, lineHeight: 20, color: '#8B4F11' },
  button: { backgroundColor: '#88034F', padding: 15, borderRadius: 10 },
  buttonText: { fontWeight: '700', textAlign: 'center', color: 'white' },
  back: { paddingVertical: 12, color: '#8D0356', fontWeight: '700' },
})
