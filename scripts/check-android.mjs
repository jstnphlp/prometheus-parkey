import { execFileSync } from 'node:child_process'
import { log } from 'node:console'

const devices = execFileSync('adb', ['devices'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((line) => /\sdevice$/.test(line))
if (devices.length !== 1)
  throw new Error(
    `Expected one authorized Android device/emulator; found ${devices.length}. Connect one and retry.`,
  )
const serial = devices[0].split(/\s+/)[0]
const installed = execFileSync(
  'adb',
  ['-s', serial, 'shell', 'pm', 'path', 'com.parkey.discovery'],
  { encoding: 'utf8' },
)
if (!installed.trim().startsWith('package:'))
  throw new Error(
    'Parkey is not installed. Build and install the development client first.',
  )
log(
  `Device ${serial} is ready. This check does not verify GPS, permissions, navigation, or photos.`,
)
