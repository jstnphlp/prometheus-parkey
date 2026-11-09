import AsyncStorage from '@react-native-async-storage/async-storage'

import { config } from './config'
import { createPublicPilotCache } from './pilot-cache'

export const publicPilotCache = createPublicPilotCache(
  AsyncStorage,
  config.supabaseUrl,
)
