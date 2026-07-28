import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Single-row (id 1) table holding the household-wide schedule for the
 * automatic bill-reminder check - there's no per-user dimension here, just
 * when the shared daily job fires. Per-user opt-in/lead-time/bill-type
 * preferences live in `user_notification_preferences` instead.
 */
export default class extends BaseSchema {
  protected tableName = 'notification_schedules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('send_hour').notNullable().defaultTo(8)
      table.timestamp('last_run_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
