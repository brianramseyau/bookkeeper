import type { HttpContext } from '@adonisjs/core/http'
import { timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import os from 'node:os'
import env from '#start/env'
import User from '#models/user'
import app from '@adonisjs/core/services/app'

const appVersion: string = JSON.parse(readFileSync(app.makePath('package.json'), 'utf-8')).version

const AUTHENTIK_EMAIL_HEADER = 'x-authentik-email'
const AUTHENTIK_SECRET_HEADER = 'x-authentik-shared-secret'

// Header values that are themselves credentials (or carry them) - dumping
// these verbatim would let someone paste this endpoint's output for support
// and hand out their session or shared secret in the process.
const SENSITIVE_HEADERS = new Set([
  'cookie',
  'authorization',
  'proxy-authorization',
  AUTHENTIK_SECRET_HEADER,
])

function redactHeaders(headers: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => {
      if (value === undefined) return [name, value]
      if (!SENSITIVE_HEADERS.has(name.toLowerCase())) return [name, value]

      const length = Array.isArray(value) ? value.join(',').length : value.length
      return [name, `[redacted, length=${length}]`]
    })
  )
}

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  )
}

/**
 * Unauthenticated on purpose: the main use case is diagnosing why the
 * Authentik proxy auto-login *isn't* logging anyone in, which is exactly
 * the situation where an auth-gated endpoint would be unreachable. Nothing
 * secret is returned - see redactHeaders and the env allowlist below.
 */
export default class DebugController {
  async index({ request, auth, response }: HttpContext) {
    const providedSecret = request.header(AUTHENTIK_SECRET_HEADER)
    const expectedSecret = env.get('AUTHENTIK_SHARED_SECRET')
    const emailHeader = request.header(AUTHENTIK_EMAIL_HEADER)

    const secretConfigured = Boolean(expectedSecret)
    const secretMatches = Boolean(
      providedSecret && expectedSecret && secretsMatch(providedSecret, expectedSecret)
    )

    const matchedUser = emailHeader ? await User.findBy('email', emailHeader) : null

    return response.json({
      server: {
        appVersion,
        nodeVersion: process.version,
        platform: `${process.platform}/${process.arch}`,
        hostname: os.hostname(),
        pid: process.pid,
        uptimeSeconds: Math.round(process.uptime()),
        now: new Date().toISOString(),
      },
      env: {
        NODE_ENV: env.get('NODE_ENV'),
        APP_URL: env.get('APP_URL'),
        HOST: env.get('HOST'),
        PORT: env.get('PORT'),
        LOG_LEVEL: env.get('LOG_LEVEL'),
        TZ: process.env.TZ ?? null,
        SESSION_DRIVER: env.get('SESSION_DRIVER'),
        DB_FILENAME: env.get('DB_FILENAME') ?? null,
        LIMITER_STORE: env.get('LIMITER_STORE'),
        APP_KEY_CONFIGURED: Boolean(env.get('APP_KEY')),
        AUTHENTIK_PROXY_AUTH_ENABLED: Boolean(env.get('AUTHENTIK_PROXY_AUTH_ENABLED')),
        AUTHENTIK_SHARED_SECRET_CONFIGURED: secretConfigured,
      },
      auth: {
        isAuthenticated: auth.isAuthenticated,
        user: auth.user
          ? { id: auth.user.id, email: auth.user.email, fullName: auth.user.fullName }
          : null,
      },
      authentikProxyAuth: {
        proxyAuthEnabled: Boolean(env.get('AUTHENTIK_PROXY_AUTH_ENABLED')),
        secretConfigured,
        secretHeaderPresent: Boolean(providedSecret),
        secretMatches,
        emailHeaderPresent: Boolean(emailHeader),
        emailHeaderValue: emailHeader ?? null,
        matchedLocalUser: matchedUser
          ? { id: matchedUser.id, email: matchedUser.email, fullName: matchedUser.fullName }
          : null,
        wouldAutoLoginOnNextRequest:
          Boolean(env.get('AUTHENTIK_PROXY_AUTH_ENABLED')) && secretMatches && matchedUser !== null,
      },
      request: {
        method: request.method(),
        url: request.url(true),
        hostname: request.hostname(),
        ip: request.ip(),
        ips: request.ips(),
        protocol: request.protocol(),
        secure: request.secure(),
      },
      headers: redactHeaders(request.headers()),
    })
  }
}
