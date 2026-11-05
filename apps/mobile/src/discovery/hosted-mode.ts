export type DiscoveryMode = 'legacy' | 'synthetic' | 'hosted' | 'disabled'

export function discoveryMode(value: string | undefined): DiscoveryMode {
  if (!value) return 'legacy'
  return value === 'synthetic' || value === 'hosted' ? value : 'disabled'
}

/** Hosted clients accept only public publishable keys and credential-free HTTPS. */
export function validHostedConfig(url: string, key: string) {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash &&
      parsed.pathname === '/' &&
      /^sb_publishable_[A-Za-z0-9_-]+$/.test(key)
    )
  } catch {
    return false
  }
}
