import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'utility_bills'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('paid').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('paid')
    })
  }
}
