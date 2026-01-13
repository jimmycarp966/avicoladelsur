import fs from 'fs'
import os from 'os'
import path from 'path'

export function ensureGoogleApplicationCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return

  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.env.GOOGLE_CLOUD_CREDENTIALS)
    return
  }

  const b64 = process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64
  if (!b64) return

  const tmpPath = path.join(os.tmpdir(), 'gcp-service-account.json')
  if (!fs.existsSync(tmpPath)) {
    const json = Buffer.from(b64, 'base64').toString('utf-8')
    fs.writeFileSync(tmpPath, json, { encoding: 'utf-8' })
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath
}
