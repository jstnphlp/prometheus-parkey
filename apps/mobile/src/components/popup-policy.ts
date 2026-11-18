export type PopupTone = 'error' | 'warning' | 'success' | 'info'
export type PopupIdentity = {
  title: string
  message: string
  tone: PopupTone
  onceKey?: string
  group?: string
}

export function createPopupGate() {
  const pending = new Set<string>()
  const seen = new Set<string>()
  const groups = new Set<string>()
  const fingerprint = (item: PopupIdentity) =>
    `${item.tone}\n${item.title}\n${item.message}`
  return {
    accept(item: PopupIdentity) {
      const key = fingerprint(item)
      if (item.onceKey && seen.has(item.onceKey)) return false
      if (pending.has(key) || (item.group && groups.has(item.group))) {
        if (item.onceKey) seen.add(item.onceKey)
        return false
      }
      pending.add(key)
      if (item.group) groups.add(item.group)
      if (item.onceKey) seen.add(item.onceKey)
      return true
    },
    finish(item: PopupIdentity) {
      pending.delete(fingerprint(item))
      if (item.group) groups.delete(item.group)
    },
    allowAgain(key: string) {
      seen.delete(key)
    },
  }
}
