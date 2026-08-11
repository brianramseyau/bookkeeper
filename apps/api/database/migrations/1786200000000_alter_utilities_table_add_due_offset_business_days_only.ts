import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'utilities'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('due_offset_business_days_only').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('due_offset_business_days_only')
    })
  }
}
