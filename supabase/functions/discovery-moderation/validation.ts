export async function readBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
    throw new TypeError('JSON required')
  const reader = request.body?.getReader()
  if (!reader) throw new TypeError('Body required')
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) {
        await reader.cancel()
        throw new RangeError('Body limit')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}

export function reviewRequest(value: unknown): {
  queue_status: 'pending_review' | 'accepted'
  page: number
  operation: 'list' | 'accepted' | 'rejected' | 'published'
  report: string | null
  reason: string | null
  public_url: string | null
  public_license: string | null
  public_attribution: string | null
} {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Object required')
  const fields = [
    'operation',
    'report',
    'reason',
    'public_url',
    'public_license',
    'public_attribution',
    'queue_status',
    'page',
  ]
  if (Object.keys(value).some((key) => !fields.includes(key)))
    throw new TypeError('Unknown field')
  const item: Record<string, unknown> = Object.fromEntries(
    Object.entries(value),
  )
  const queue_status = item.queue_status ?? 'pending_review'
  const page = item.page ?? 0
  if (
    (queue_status !== 'pending_review' && queue_status !== 'accepted') ||
    typeof page !== 'number' ||
    !Number.isInteger(page) ||
    page < 0 ||
    page > 1000
  )
    throw new TypeError('Queue selection')
  const operation = item.operation
  if (
    operation !== 'list' &&
    operation !== 'accepted' &&
    operation !== 'rejected' &&
    operation !== 'published'
  )
    throw new TypeError('Operation')
  const text = (key: string, min: number, max: number): string | null => {
    const field = item[key]
    if (field === undefined || field === null) return null
    if (
      typeof field !== 'string' ||
      field.trim().length < min ||
      field.trim().length > max ||
      /[\u0000-\u001f\u007f]/.test(field)
    )
      throw new TypeError(key)
    return field.trim()
  }
  const report = text('report', 36, 36)
  const reason = text('reason', 3, 500)
  const public_url = text('public_url', 1, 1000)
  const public_license = text('public_license', 3, 200)
  const public_attribution = text('public_attribution', 3, 500)
  if (
    operation !== 'list' &&
    (!report ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        report,
      ) ||
      !reason)
  )
    throw new TypeError('Review fields')
  if (operation === 'published') {
    if (!public_url || !public_license || !public_attribution)
      throw new TypeError('Provenance required')
    const url = new URL(public_url)
    if (url.protocol !== 'https:' || url.username || url.password || url.hash)
      throw new TypeError('Public URL')
  }
  return {
    queue_status,
    page,
    operation,
    report,
    reason,
    public_url,
    public_license,
    public_attribution,
  }
}
