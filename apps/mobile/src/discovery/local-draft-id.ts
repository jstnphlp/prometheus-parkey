let sequence = 0

/** Local correlation only; the server owns authorization and private receipt IDs. */
export function createLocalDraftId() {
  sequence += 1
  return `local-${Date.now()}-${sequence.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
