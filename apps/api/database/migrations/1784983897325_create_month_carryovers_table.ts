import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'month_carryovers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('year').notNullable()
      table.integer('month').notNullable()
      table.decimal('amount', 10, 2).notNullable()
      table.text('notes').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['year', 'month'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
