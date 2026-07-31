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

        router.get('expenses', [controllers.Expenses, 'index'])
        router.post('expenses', [controllers.Expenses, 'store'])
        router.patch('expenses/:id', [controllers.Expenses, 'update'])
        router.delete('expenses/:id', [controllers.Expenses, 'destroy'])
        router.put('expenses/:id/payments/:year/:month', [controllers.Expenses, 'upsertPayment'])

        router.get('expenses/:id/actuals', [controllers.ExpenseActuals, 'index'])
        router.post('expenses/:id/actuals', [controllers.ExpenseActuals, 'store'])
        router.get('expenses/:id/trend', [controllers.ExpenseActuals, 'trend'])
        router.patch('expense-actuals/:id', [controllers.ExpenseActuals, 'update'])
        router.delete('expense-actuals/:id', [controllers.ExpenseActuals, 'destroy'])

        router.get('expenses/:id/budget-items', [controllers.ExpenseBudgetItems, 'index'])
        router.post('expenses/:id/budget-items', [controllers.ExpenseBudgetItems, 'store'])
        router.patch('expense-budget-items/:id', [controllers.ExpenseBudgetItems, 'update'])
        router.delete('expense-budget-items/:id', [controllers.ExpenseBudgetItems, 'destroy'])

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

        router.get('income-tax-settings', [controllers.IncomeTaxSettings, 'show'])
        router.put('income-tax-settings', [controllers.IncomeTaxSettings, 'upsert'])

        router.get('standard-month', [controllers.StandardMonths, 'show'])

        router.get('month-carryovers/:year/:month', [controllers.MonthCarryovers, 'show'])
        router.put('month-carryovers/:year/:month', [controllers.MonthCarryovers, 'upsert'])

        router.get('dashboard/summary', [controllers.Dashboard, 'summary'])

        router.get('export/json', [controllers.Export, 'json'])
        router.get('export/csv/:table', [controllers.Export, 'csv'])

        router.get('backups', [controllers.Backups, 'index'])
        router.post('backups', [controllers.Backups, 'store'])
        router.get('backups/:filename/download', [controllers.Backups, 'download'])
        router.delete('backups/:filename', [controllers.Backups, 'destroy'])

        router.get('backup-settings', [controllers.BackupSettings, 'show'])
        router.put('backup-settings', [controllers.BackupSettings, 'update'])

        router.get('notification-schedule', [controllers.NotificationSchedules, 'show'])
        router.put('notification-schedule', [controllers.NotificationSchedules, 'update'])

        router.get('notification-preferences', [controllers.NotificationPreferences, 'show'])
        router.put('notification-preferences', [controllers.NotificationPreferences, 'update'])

        router.get('push-public-key', [controllers.PushSubscriptions, 'publicKey'])
        router.get('push-subscriptions', [controllers.PushSubscriptions, 'index'])
        router.post('push-subscriptions', [controllers.PushSubscriptions, 'store'])
        router.delete('push-subscriptions/:id', [controllers.PushSubscriptions, 'destroy'])
        router.post('push-subscriptions/test', [controllers.PushSubscriptions, 'test'])
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
