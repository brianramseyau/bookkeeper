import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'utilities'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('frequency').notNullable().defaultTo('monthly')
      table.integer('due_offset_days').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('frequency')
      table.dropColumn('due_offset_days')
    })
  }
}
