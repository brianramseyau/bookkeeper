import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Replaces the backup schedule's elapsed-time/anchor columns
 * (`interval_hours`, `run_hour`, `last_run_at`, `retention_days`) with a
 * simpler time-of-day/frequency/count model (`frequency`, `time_of_day`,
 * `retention_count`) - see `#services/backup_scheduler`. The old model
 * tracked `last_run_at` in this table and compared it against an
 * hours-since-a-fixed-epoch "slot" calculation, which in production
 * regularly disagreed with itself across restarts/polls and fired a backup
 * on every 15-minute poll instead of once a day. The new model has nothing
 * to get out of sync: due-ness is derived from the actual timestamp of the
 * most recent automatic backup file on disk (see `listBackups` /
 * `lastAutomaticBackupAt`) compared against a period start computed fresh
 * from `frequency` + `time_of_day` each time, so there's no separate
 * "last run" state this table (or anything else) needs to persist.
 *
 * No `disableTransactions`/`PRAGMA foreign_keys` dance needed here (see
 * AGENTS.md's SQLite table-rebuild section) - nothing has a foreign key
 * pointing at `backup_settings`, so SQLite rebuilding this table on
 * `dropColumn` can't cascade-delete anything.
 */
export default class extends BaseSchema {
  protected tableName = 'backup_settings'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('frequency').notNullable().defaultTo('daily')
      table.string('time_of_day').notNullable().defaultTo('01:00')
      table.integer('retention_count').notNullable().defaultTo(7)
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('interval_hours')
      table.dropColumn('retention_days')
      table.dropColumn('run_hour')
      table.dropColumn('last_run_at')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('interval_hours').notNullable().defaultTo(24)
      table.integer('retention_days').notNullable().defaultTo(7)
      table.integer('run_hour').notNullable().defaultTo(1)
      table.timestamp('last_run_at').nullable()
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('frequency')
      table.dropColumn('time_of_day')
      table.dropColumn('retention_count')
    })
  }
}
