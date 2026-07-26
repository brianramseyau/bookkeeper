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
        router.post('categories', [controllers.Categories, 'store'])
        router.patch('categories/:id', [controllers.Categories, 'update'])
        router.delete('categories/:id', [controllers.Categories, 'destroy'])

        router.get('categories/:id/actuals', [controllers.CategoryActuals, 'index'])
        router.post('categories/:id/actuals', [controllers.CategoryActuals, 'store'])
        router.get('categories/:id/trend', [controllers.CategoryActuals, 'trend'])
        router.patch('category-actuals/:id', [controllers.CategoryActuals, 'update'])
        router.delete('category-actuals/:id', [controllers.CategoryActuals, 'destroy'])

        router.get('categories/:id/budget-items', [controllers.CategoryBudgetItems, 'index'])
        router.post('categories/:id/budget-items', [controllers.CategoryBudgetItems, 'store'])
        router.patch('category-budget-items/:id', [controllers.CategoryBudgetItems, 'update'])
        router.delete('category-budget-items/:id', [controllers.CategoryBudgetItems, 'destroy'])

        router.get('users', [controllers.Users, 'index'])
        router.patch('users/:id', [controllers.Users, 'update'])
        router.put('users/:id/password', [controllers.Users, 'changePassword'])
        router.put('users/:id/email', [controllers.Users, 'changeEmail'])

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
        router.put('recurring-bills/:id/payments/:year/:month', [
          controllers.RecurringBills,
          'upsertPayment',
        ])

        router.get('subscriptions/summary', [controllers.Subscriptions, 'summary'])
        router.get('subscriptions', [controllers.Subscriptions, 'index'])
        router.post('subscriptions', [controllers.Subscriptions, 'store'])
        router.patch('subscriptions/:id', [controllers.Subscriptions, 'update'])
        router.delete('subscriptions/:id', [controllers.Subscriptions, 'destroy'])
        router.put('subscriptions/:id/payments/:year/:month', [
          controllers.Subscriptions,
          'upsertPayment',
        ])

        router.get('income-sources/summary', [controllers.IncomeSources, 'summary'])
        router.get('income-sources/ytd', [controllers.IncomeSources, 'ytd'])
        router.get('income-sources', [controllers.IncomeSources, 'index'])
        router.post('income-sources', [controllers.IncomeSources, 'store'])
        router.patch('income-sources/:id', [controllers.IncomeSources, 'update'])
        router.delete('income-sources/:id', [controllers.IncomeSources, 'destroy'])

        router.get('income-entries', [controllers.IncomeEntries, 'index'])
        router.post('income-entries', [controllers.IncomeEntries, 'store'])
        router.patch('income-entries/:id', [controllers.IncomeEntries, 'update'])
        router.delete('income-entries/:id', [controllers.IncomeEntries, 'destroy'])

        router.get('standard-month', [controllers.StandardMonths, 'show'])

        router.get('month-carryovers/:year/:month', [controllers.MonthCarryovers, 'show'])
        router.put('month-carryovers/:year/:month', [controllers.MonthCarryovers, 'upsert'])

        router.get('dashboard/summary', [controllers.Dashboard, 'summary'])

        router.get('export/json', [controllers.Export, 'json'])
        router.get('export/csv/:table', [controllers.Export, 'csv'])
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
