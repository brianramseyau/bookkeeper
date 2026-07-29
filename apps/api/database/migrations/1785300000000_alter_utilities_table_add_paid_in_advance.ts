import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'utilities'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('paid_in_advance').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('paid_in_advance')
    })
  }
}
