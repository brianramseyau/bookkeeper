/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import app from '@adonisjs/core/services/app'
import { controllers } from '#generated/controllers'

router
  .group(() => {
    router.post('login', [controllers.Auth, 'login'])

    router
      .group(() => {
        router.post('logout', [controllers.Auth, 'logout'])
        router.get('me', [controllers.Auth, 'me'])

        router.get('categories', [controllers.Categories, 'index'])
        router.get('users', [controllers.Users, 'index'])

        router.get('utilities', [controllers.Utilities, 'index'])
        router.post('utilities', [controllers.Utilities, 'store'])
        router.patch('utilities/:id', [controllers.Utilities, 'update'])
        router.delete('utilities/:id', [controllers.Utilities, 'destroy'])

        router.get('utilities/:utilityId/bills', [controllers.UtilityBills, 'index'])
        router.put('utilities/:utilityId/bills/:year/:month', [controllers.UtilityBills, 'upsert'])
        router.get('utilities/:utilityId/trend', [controllers.UtilityBills, 'trend'])
        router.delete('utility-bills/:id', [controllers.UtilityBills, 'destroy'])

        router.get('recurring-bills/upcoming', [controllers.RecurringBills, 'upcoming'])
        router.get('recurring-bills', [controllers.RecurringBills, 'index'])
        router.post('recurring-bills', [controllers.RecurringBills, 'store'])
        router.patch('recurring-bills/:id', [controllers.RecurringBills, 'update'])
        router.delete('recurring-bills/:id', [controllers.RecurringBills, 'destroy'])

        router.get('subscriptions/summary', [controllers.Subscriptions, 'summary'])
        router.get('subscriptions', [controllers.Subscriptions, 'index'])
        router.post('subscriptions', [controllers.Subscriptions, 'store'])
        router.patch('subscriptions/:id', [controllers.Subscriptions, 'update'])
        router.delete('subscriptions/:id', [controllers.Subscriptions, 'destroy'])
      })
      .use(middleware.auth())
  })
  .prefix('/api')

/**
 * SPA fallback: anything that isn't an API route or a real static asset
 * (already handled by the static middleware before requests reach here)
 * gets the SvelteKit build's fallback index.html, so client-side routing
 * works on refresh/deep-link for routes adapter-static couldn't prerender.
 */
router.get('*', ({ response }) => {
  return response.download(app.publicPath('index.html'))
})
