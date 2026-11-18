import baseMarker from '../../assets/figma/main-ui/parking-marker.png'
import garageMarker from '../../assets/figma/main-ui/parking-garage-marker.png'
import streetMarker from '../../assets/figma/main-ui/street-parking-marker.png'
import entranceMarker from '../../assets/figma/main-ui/parking-entrance-marker.png'
import spaceMarker from '../../assets/figma/main-ui/parking-space-marker.png'
import unclassifiedMarker from '../../assets/figma/main-ui/unclassified-parking-marker.png'
import chargingBadge from '../../assets/figma/main-ui/ev-charging-badge.png'

import { mainMarkerIds } from './map-marker-style'

export const mainMarkerImages = {
  [mainMarkerIds.lot]: baseMarker,
  [mainMarkerIds.garage]: garageMarker,
  [mainMarkerIds.street]: streetMarker,
  [mainMarkerIds.entrance]: entranceMarker,
  [mainMarkerIds.space]: spaceMarker,
  [mainMarkerIds.unclassified]: unclassifiedMarker,
  [mainMarkerIds.charging]: chargingBadge,
}
