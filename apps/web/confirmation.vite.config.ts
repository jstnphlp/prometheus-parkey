import { fileURLToPath } from 'node:url'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import { confirmationConfiguration } from './src/auth/email-confirmation.ts'

// A static auth-only site for parkey.promths.com. Never publish the moderation
// workspace or its server bundle to this public confirmation domain.
export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('.', import.meta.url))
  const env = { ...loadEnv(mode, envDir, 'VITE_'), ...process.env }
  const origin = confirmationConfiguration({
    url: env.VITE_SUPABASE_URL ?? '',
    key: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  })
  if (origin !== 'https://nuepweyzpkqfihjsbsik.supabase.co')
    throw new Error(
      'Confirmation build requires the Parkey public Supabase URL and publishable/anonymous key. Never use a secret or service-role key.',
    )
  return {
    root: fileURLToPath(new URL('./confirmation', import.meta.url)),
    envDir,
    plugins: [viteReact()],
    build: { outDir: '../dist/confirmation', emptyOutDir: true },
  }
})
