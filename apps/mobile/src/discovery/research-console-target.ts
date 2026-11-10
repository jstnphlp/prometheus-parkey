import { publicEndpointProblem } from './pilot-config.ts'

/** An external handoff must not carry credentials, session queries or fragments. */
export function researchConsoleTarget(
  value: string,
  development: boolean,
): string | null {
  if (!value || publicEndpointProblem(value, !development)) return null
  const url = new URL(value)
  if (
    url.protocol === 'http:' &&
    (!development ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.port ||
      url.pathname !== '/')
  )
    return null
  return url.href
}
