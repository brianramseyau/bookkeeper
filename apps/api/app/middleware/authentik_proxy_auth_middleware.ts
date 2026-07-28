import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { timingSafeEqual } from 'node:crypto'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'

const EMAIL_HEADER = 'x-authentik-email'
const SECRET_HEADER = 'x-authentik-shared-secret'

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  )
}

/**
 * Auto-logs-in requests carrying a trusted Authentik reverse-proxy header,
 * matching X-authentik-email to a local user. Runs after silent auth, so it
 * only does work when the request has no existing session. Requires a
 * shared secret (configured on both the Authentik proxy provider and here)
 * so the headers can't be spoofed by a request that reaches this app
 * without going through the proxy.
 */
export default class AuthentikProxyAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!env.get('AUTHENTIK_PROXY_AUTH_ENABLED') || ctx.auth.isAuthenticated) {
      return next()
    }

    const expectedSecret = env.get('AUTHENTIK_SHARED_SECRET')
    if (!expectedSecret) {
      logger.warn(
        'AUTHENTIK_PROXY_AUTH_ENABLED is set but AUTHENTIK_SHARED_SECRET is empty; skipping proxy auto-login'
      )
      return next()
    }

    const providedSecret = ctx.request.header(SECRET_HEADER)
    if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
      return next()
    }

    const email = ctx.request.header(EMAIL_HEADER)
    if (!email) {
      return next()
    }

    const user = await User.findBy('email', email)
    if (!user) {
      return next()
    }

    await ctx.auth.use('web').login(user)

    return next()
  }
}
