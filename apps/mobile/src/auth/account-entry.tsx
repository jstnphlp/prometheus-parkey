import { useRouter } from 'expo-router'

import { BrandButton } from '../components/brand-button'

import { useAuth } from './provider'

export function AccountEntry() {
  const router = useRouter()
  const { state } = useAuth()
  return (
    <BrandButton
      title={
        state.status === 'signed-in' ? 'Your account' : 'Account · optional'
      }
      onPress={() => router.push('/account')}
    />
  )
}
