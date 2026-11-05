import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.output/**',
    '**/.tanstack/**',
    '**/.expo/**',
    '**/expo-env.d.ts',
    '**/routeTree.gen.ts',
    'output/playwright/**',
    'output/ncr/**',
    'apps/mobile/android/**',
    'apps/mobile/ios/**',
    'apps/mobile/public/maplibre/**',
    'supabase/**',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
  prettier,
)
