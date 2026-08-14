import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds a fixed hour-of-day anchor for the backup schedule, mirroring
 * `notification_schedules.send_hour`. Previously the schedule only tracked
 * `interval_hours` elapsed since `last_run_at`, which drifts around the
 * clock over time (each run's timestamp shifts by however late the 15-minute
 * poll loop happened to fire) rather than landing at a predictable time -
 * `run_hour` anchors every interval to a fixed clock time instead.
 */
export default class extends BaseSchema {
  protected tableName = 'backup_settings'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('run_hour').notNullable().defaultTo(1)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('run_hour')
    })
  }
}
