import Svg, { Circle, Path, Rect } from 'react-native-svg'

import { colors } from '../theme'

export type BrandIconName =
  | 'person'
  | 'mail'
  | 'lock'
  | 'shield-check'
  | 'eye'
  | 'eye-off'
  | 'check'
  | 'info'
  | 'warning'
  | 'error'
  | 'close'

export function BrandIcon({
  name,
  size = 22,
  color = colors.fieldIcon,
}: {
  name: BrandIconName
  size?: number
  color?: string
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {name === 'person' ? (
        <>
          <Circle cx={12} cy={8} r={4} />
          <Path d="M4 21v-2a8 8 0 0 1 16 0v2" />
        </>
      ) : null}
      {name === 'mail' ? (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={3} />
          <Path d="m4 7 8 6 8-6" />
        </>
      ) : null}
      {name === 'lock' ? (
        <>
          <Rect x={5} y={10} width={14} height={11} rx={3} />
          <Path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
        </>
      ) : null}
      {name === 'shield-check' ? (
        <>
          <Path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" />
          <Path d="m8 12 3 3 5-6" />
        </>
      ) : null}
      {name === 'eye' || name === 'eye-off' ? (
        <>
          <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <Circle cx={12} cy={12} r={3} />
          {name === 'eye-off' ? (
            <Path d="m3 3 18 18" strokeWidth={2.5} />
          ) : null}
        </>
      ) : null}
      {name === 'check' ? <Path d="m5 12 4 4L19 6" /> : null}
      {name === 'close' ? <Path d="m6 6 12 12M6 18 18 6" /> : null}
      {name === 'info' || name === 'error' ? (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d={name === 'info' ? 'M12 11v6m0-10v.01' : 'M12 7v6m0 4v.01'} />
        </>
      ) : null}
      {name === 'warning' ? (
        <>
          <Path d="m10.3 4.5-8 14A1.7 1.7 0 0 0 3.8 21h16.4a1.7 1.7 0 0 0 1.5-2.5l-8-14a1.95 1.95 0 0 0-3.4 0Z" />
          <Path d="M12 9v4m0 4v.01" />
        </>
      ) : null}
    </Svg>
  )
}
