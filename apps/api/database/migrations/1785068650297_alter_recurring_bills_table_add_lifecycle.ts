import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'recurring_bills'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_paused').notNullable().defaultTo(false)
      table.boolean('is_archived').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_paused')
      table.dropColumn('is_archived')
    })
  }
}
