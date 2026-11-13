import { createHandler } from './handler.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Promise<Response>): void
}

Deno.serve(
  createHandler(
    Object.fromEntries(
      [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'MOBILE_REPORTS_ENABLED',
        'MOBILE_REPORTS_PRIVACY_APPROVED',
        'MOBILE_REPORTS_WEB_ORIGIN',
      ].map((name) => [name, Deno.env.get(name)]),
    ),
  ),
)
