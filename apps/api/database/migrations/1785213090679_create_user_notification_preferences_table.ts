import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per user - opt-in bill-reminder preferences. Deliberately
 * per-user rather than a single household-wide toggle: one person may not
 * care about subscription reminders (e.g. auto-debited from a credit card)
 * while still wanting utility/recurring bill reminders.
 */
export default class extends BaseSchema {
  protected tableName = 'user_notification_preferences'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.boolean('enabled').notNullable().defaultTo(false)
      table.integer('lead_days').notNullable().defaultTo(3)
      table.boolean('notify_utility_bills').notNullable().defaultTo(true)
      table.boolean('notify_recurring_bills').notNullable().defaultTo(true)
      table.boolean('notify_subscriptions').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
