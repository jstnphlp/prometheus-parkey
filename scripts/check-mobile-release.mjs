import process from 'node:process'

process.env.NODE_ENV = 'production'
process.env.PARKEY_RELEASE_BUILD = 'true'
await import('./check-release.mjs')
