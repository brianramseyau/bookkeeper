import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Single-row (id 1) table holding the automatic backup schedule - there's no
 * per-user or per-entity dimension here, just one household-wide setting.
 */
export default class extends BaseSchema {
  protected tableName = 'backup_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.boolean('enabled').notNullable().defaultTo(true)
      table.integer('interval_hours').notNullable().defaultTo(24)
      table.integer('retention_days').notNullable().defaultTo(7)
      table.timestamp('last_run_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
