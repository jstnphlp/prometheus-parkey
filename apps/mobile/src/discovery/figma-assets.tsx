import { Image } from 'react-native'

import { useTheme } from '../theme-provider'
import asset6 from '../../assets/figma/more.png'
import asset7 from '../../assets/figma/plus.png'
import asset8 from '../../assets/figma/locate.png'
import asset9 from '../../assets/figma/info.png'
import asset12 from '../../assets/figma/search.png'
import asset13 from '../../assets/figma/star.png'
import asset14 from '../../assets/figma/camera.png'
import asset15 from '../../assets/figma/pencil.png'
import asset17 from '../../assets/figma/camera-large.png'
import asset22 from '../../assets/figma/turn-right.png'
import asset23 from '../../assets/figma/then-left.png'
import asset25 from '../../assets/figma/ring.png'
import asset29 from '../../assets/figma/car-white.png'
import playful0 from '../../assets/figma/playful/mascot.png'
import playful1 from '../../assets/figma/playful/selected-spot.png'
import playful2 from '../../assets/figma/playful/arrow.png'
import playful3 from '../../assets/figma/playful/map-active.png'
import playful4 from '../../assets/figma/playful/map.png'
import playful5 from '../../assets/figma/playful/saved.png'
import playful6 from '../../assets/figma/playful/saved-active.png'
import playful7 from '../../assets/figma/playful/user.png'
import playful8 from '../../assets/figma/playful/user-active.png'
import playful9 from '../../assets/figma/playful/close.png'
import playful10 from '../../assets/figma/playful/bookmark.png'
import playful11 from '../../assets/figma/playful/clock.png'
import playful12 from '../../assets/figma/playful/fees.png'
import playful13 from '../../assets/figma/playful/spaces.png'
import playful14 from '../../assets/figma/playful/access.png'
import playful15 from '../../assets/figma/playful/home.png'
import playful16 from '../../assets/figma/playful/work.png'
import playful17 from '../../assets/figma/playful/car.png'
import playful18 from '../../assets/figma/playful/plus-small.png'
import playful19 from '../../assets/figma/playful/pin.png'
import playful20 from '../../assets/figma/playful/contributed.png'
import playful21 from '../../assets/figma/playful/warning.png'
import playful22 from '../../assets/figma/playful/arrived.png'
import playful23 from '../../assets/figma/playful/confetti.png'
import playful24 from '../../assets/figma/playful/confetti-1.png'
import playful25 from '../../assets/figma/playful/confetti-2.png'
import playful26 from '../../assets/figma/playful/confetti-3.png'
import extra0 from '../../assets/figma/playful/arrival-ring.png'
import extra1 from '../../assets/figma/playful/search-white.png'
import v2Asset0 from '../../assets/figma/playful/go.png'
import v2Asset1 from '../../assets/figma/playful/search-muted.png'
import v2Asset2 from '../../assets/figma/playful/add-spot.png'
import v2Asset3 from '../../assets/figma/playful/locate-ink.png'
import v2Asset4 from '../../assets/figma/playful/check-white.png'
import v2Asset5 from '../../assets/figma/playful/arrival-info.png'
import v2Asset6 from '../../assets/figma/playful/info-brand.png'
import v2Asset7 from '../../assets/figma/playful/camera-brand.png'
import v2Asset8 from '../../assets/figma/playful/pencil-brand.png'
import v2Asset9 from '../../assets/figma/playful/nav-up.png'
import v2Asset10 from '../../assets/figma/playful/nav-right.png'
import v2Asset11 from '../../assets/figma/playful/nav-left.png'
import chevronRight from '../../assets/figma/playful/chevron-right.png'
import lockTeal from '../../assets/figma/playful/lock-teal.png'
import shieldTeal from '../../assets/figma/playful/shield-teal.png'
import viewedBrand from '../../assets/figma/playful/viewed-brand.png'
import draftBrand from '../../assets/figma/playful/draft-brand.png'
import infoWarning from '../../assets/figma/playful/info-warning.png'
import noResults from '../../assets/figma/playful/no-results.png'
import zoomInBrand from '../../assets/figma/playful/zoom-in-brand.png'
import filterBrand from '../../assets/figma/playful/filter-brand.png'
import locationOff from '../../assets/figma/playful/location-off.png'
import offline from '../../assets/figma/playful/offline.png'
import walkBackArrow from '../../assets/figma/playful/walk-back-arrow.png'

const assets = {
  'walk-back-arrow': { source: walkBackArrow, width: 18, height: 18 },
  'chevron-right': { source: chevronRight, width: 24, height: 24 },
  'lock-teal': { source: lockTeal, width: 20, height: 20 },
  'shield-teal': { source: shieldTeal, width: 20, height: 20 },
  'viewed-brand': { source: viewedBrand, width: 24, height: 24 },
  'draft-brand': { source: draftBrand, width: 24, height: 24 },
  'info-warning': { source: infoWarning, width: 20, height: 20 },
  'no-results': { source: noResults, width: 22, height: 22 },
  'zoom-in-brand': { source: zoomInBrand, width: 22, height: 22 },
  'filter-brand': { source: filterBrand, width: 22, height: 22 },
  'location-off': { source: locationOff, width: 22, height: 22 },
  offline: { source: offline, width: 20, height: 20 },
  go: { source: v2Asset0, width: 24, height: 24 },
  'search-muted': { source: v2Asset1, width: 24, height: 24 },
  'add-spot': { source: v2Asset2, width: 24, height: 24 },
  'locate-ink': { source: v2Asset3, width: 24, height: 24 },
  'check-white': { source: v2Asset4, width: 20, height: 20 },
  'arrival-info': { source: v2Asset5, width: 24, height: 24 },
  'info-brand': { source: v2Asset6, width: 24, height: 24 },
  'camera-brand': { source: v2Asset7, width: 24, height: 24 },
  'pencil-brand': { source: v2Asset8, width: 24, height: 24 },
  'nav-up': { source: v2Asset9, width: 24, height: 24 },
  'nav-right': { source: v2Asset10, width: 33.6, height: 33.6 },
  'nav-left': { source: v2Asset11, width: 24, height: 24 },

  'search-white': { source: extra1, width: 20.0, height: 20.0 },
  'arrival-ring': { source: extra0, width: 130.0, height: 130.0 },
  'confetti-3': { source: playful26, width: 10.0, height: 10.0 },
  'confetti-2': { source: playful25, width: 10.0, height: 10.0 },
  'confetti-1': { source: playful24, width: 10.0, height: 10.0 },
  confetti: { source: playful23, width: 10.0, height: 10.0 },
  arrived: { source: playful22, width: 98.6, height: 116.0 },
  'selected-spot': { source: playful1, width: 68.0, height: 80.0 },
  mascot: { source: playful0, width: 56.0, height: 68.0 },
  'map-active': { source: playful3, width: 24.0, height: 24.0 },
  map: { source: playful4, width: 24.0, height: 24.0 },
  saved: { source: playful5, width: 24.0, height: 24.0 },
  'saved-active': { source: playful6, width: 24.0, height: 24.0 },
  user: { source: playful7, width: 24.0, height: 24.0 },
  'user-active': { source: playful8, width: 24.0, height: 24.0 },
  more: { source: asset6, width: 26, height: 26 },
  plus: { source: asset7, width: 28, height: 28 },
  locate: { source: asset8, width: 24, height: 24 },
  info: { source: asset9, width: 18, height: 18 },
  pin: { source: playful19, width: 24.0, height: 24.0 },
  arrow: { source: playful2, width: 20.0, height: 20.0 },
  search: { source: asset12, width: 22, height: 22 },
  star: { source: asset13, width: 24, height: 24 },
  camera: { source: asset14, width: 24, height: 24 },
  pencil: { source: asset15, width: 18, height: 18 },
  close: { source: playful9, width: 20.0, height: 20.0 },
  'camera-large': { source: asset17, width: 28, height: 28 },
  clock: { source: playful11, width: 24.0, height: 24.0 },
  fees: { source: playful12, width: 24.0, height: 24.0 },
  spaces: { source: playful13, width: 24.0, height: 24.0 },
  access: { source: playful14, width: 24.0, height: 24.0 },
  'turn-right': { source: asset22, width: 34, height: 34 },
  'then-left': { source: asset23, width: 16, height: 16 },
  warning: { source: playful21, width: 24.0, height: 24.0 },
  ring: { source: asset25, width: 96, height: 96 },
  bookmark: { source: playful10, width: 24.0, height: 24.0 },
  contributed: { source: playful20, width: 24.0, height: 24.0 },
  car: { source: playful17, width: 24.0, height: 24.0 },
  'car-white': { source: asset29, width: 22, height: 22 },
  'plus-small': { source: playful18, width: 24.0, height: 24.0 },
  home: { source: playful15, width: 24.0, height: 24.0 },
  work: { source: playful16, width: 24.0, height: 24.0 },
}

export type FigmaAssetName = keyof typeof assets

// Preserve each Figma export's intrinsic aspect ratio.
export function FigmaAsset({
  name,
  size,
}: {
  name: FigmaAssetName
  size?: number
}) {
  const { colors } = useTheme()
  const inkIcons: readonly FigmaAssetName[] = [
    'locate-ink',
    'search-muted',
    'close',
    'camera',
    'search',
    'info',
  ]
  const actionIcons: readonly FigmaAssetName[] = [
    'bookmark',
    'clock',
    'fees',
    'access',
    'home',
    'work',
    'car',
    'pin',
    'star',
    'info-brand',
    'viewed-brand',
    'draft-brand',
    'zoom-in-brand',
    'filter-brand',
    'chevron-right',
    'pencil-brand',
    'camera-brand',
  ]
  const tintColor = inkIcons.includes(name)
    ? colors.muted
    : actionIcons.includes(name)
      ? colors.link
      : undefined
  const asset = assets[name]
  const width = size ?? asset.width
  return (
    <Image
      accessible={false}
      source={asset.source}
      resizeMode="contain"
      style={{
        width,
        height: (width * asset.height) / asset.width,
        ...(tintColor ? { tintColor } : {}),
      }}
    />
  )
}
