/*
|--------------------------------------------------------------------------
| Define HTTP limiters
|--------------------------------------------------------------------------
|
| The "limiter.define" method creates an HTTP middleware to apply rate
| limits on a route or a group of routes. Feel free to define as many
| throttle middleware as needed.
|
*/

import limiter from '@adonisjs/limiter/services/main'

export const throttle = limiter.define('global', () => {
  return limiter.allowRequests(10).every('1 minute')
})

/**
 * Throttles login attempts per IP+email pair, so a single attacker can't
 * brute-force one account and a compromised IP can't be used to spray
 * many accounts without each pair independently hitting the limit.
 */
export const loginThrottle = limiter.define('login', (ctx) => {
  const email = ctx.request.input('email', 'unknown')

  return limiter.allowRequests(5).every('15 minutes').usingKey(`${ctx.request.ip()}:${email}`)
})
