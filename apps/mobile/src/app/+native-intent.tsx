import 'react-native-url-polyfill/auto'

import { normalizeAuthLink } from '../auth/links'

export function redirectSystemPath({
  path,
}: {
  path: string
  initial: boolean
}) {
  return normalizeAuthLink(path)
}
