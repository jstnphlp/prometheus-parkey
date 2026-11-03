import { createHandler } from './handler.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Promise<Response>): void
}

Deno.serve(
  createHandler({
    MODERATION_ORIGIN: Deno.env.get('MODERATION_ORIGIN'),
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  }),
)
