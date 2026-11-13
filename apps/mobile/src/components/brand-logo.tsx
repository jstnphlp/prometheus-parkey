import { Image } from 'react-native'
import type { ImageStyle, StyleProp } from 'react-native'

import account from '../../assets/figma/onboarding/account-logo.png'
import splash from '../../assets/figma/onboarding/splash-logo.png'
import welcome from '../../assets/figma/onboarding/welcome-logo.png'

const logos = {
  splash: { source: splash, width: 176, height: 192.574 },
  welcome: { source: welcome, width: 96, height: 106 },
  account: { source: account, width: 66, height: 72.2152 },
} as const

export function BrandLogo({
  variant,
  style,
}: {
  variant: keyof typeof logos
  style?: StyleProp<ImageStyle>
}) {
  const logo = logos[variant]
  return (
    <Image
      source={logo.source}
      accessibilityLabel="Parkey"
      accessibilityRole="image"
      resizeMode="contain"
      style={[
        { width: logo.width, height: logo.height, alignSelf: 'center' },
        style,
      ]}
    />
  )
}
