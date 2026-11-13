import { createHandler } from './handler.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Promise<Response>): void
}

Deno.serve(
  createHandler(
    Object.fromEntries(
      [
        'LOCATIONIQ_API_TOKEN',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'PLACE_SEARCH_PUBLIC_KEY',
        'PLACE_SEARCH_WEB_ORIGINS',
      ].map((name) => [name, Deno.env.get(name)]),
    ),
  ),
)
