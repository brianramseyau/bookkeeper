import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import https from 'node:https'

/**
 * A real, valid P-256 subscription key pair - `web-push` validates the
 * `p256dh` key length (65-byte uncompressed EC point) before it will even
 * attempt to encrypt a payload, so a placeholder string isn't enough to
 * exercise the real send path.
 */
export function generateTestSubscriptionKeys(): { p256dh: string; auth: string } {
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.generateKeys()
  return {
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: crypto.randomBytes(16).toString('base64url'),
  }
}

/**
 * A real local HTTPS server standing in for a browser's push service, so
 * `sendPushNotification` can be exercised end-to-end (real TLS request,
 * real status-code handling) rather than mocking the `web-push` module.
 * Uses a throwaway self-signed cert generated via the system `openssl`
 * binary - this app has no CI matrix, only the maintainer's own machine,
 * where `openssl` is already confirmed present.
 */
export interface FakePushServer {
  url: string
  setResponseStatus(code: number): void
  getRequestCount(): number
  resetRequestCount(): void
  close(): Promise<void>
}

export async function startFakePushServer(): Promise<FakePushServer> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookkeeper-push-test-'))
  const keyPath = path.join(dir, 'key.pem')
  const certPath = path.join(dir, 'cert.pem')

  execFileSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    keyPath,
    '-out',
    certPath,
    '-days',
    '1',
    '-subj',
    '/CN=localhost',
  ])

  let responseStatus = 201
  let requestCount = 0

  const server = https.createServer(
    { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
    (req, res) => {
      requestCount++
      req.resume()
      req.on('end', () => {
        res.writeHead(responseStatus)
        res.end()
      })
    }
  )

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind fake push server to a port')
  }

  return {
    url: `https://127.0.0.1:${address.port}/push`,
    setResponseStatus: (code: number) => {
      responseStatus = code
    },
    getRequestCount: () => requestCount,
    resetRequestCount: () => {
      requestCount = 0
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}
