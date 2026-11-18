import { Image } from 'react-native'
import type { ImageStyle, StyleProp } from 'react-native'

import official from '../../assets/figma/interactive/official-parkey-p.png'
import darkOfficial from '../../assets/figma/interactive/official-parkey-p-dark.png'
import { useTheme } from '../theme-provider'

const logos = {
  splash: { source: official, width: 176, height: 192.574 },
  welcome: { source: official, width: 96, height: 106 },
  account: { source: official, width: 66, height: 72.2152 },
} as const

export function BrandLogo({
  variant,
  style,
  artwork = 'entry',
}: {
  variant: keyof typeof logos
  style?: StyleProp<ImageStyle>
  artwork?: 'entry' | 'magenta'
}) {
  const logo = logos[variant]
  const { dark } = useTheme()
  return (
    <Image
      source={dark && artwork === 'entry' ? darkOfficial : logo.source}
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
