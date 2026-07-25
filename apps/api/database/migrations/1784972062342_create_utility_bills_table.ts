import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'utility_bills'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('utility_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('utilities')
        .onDelete('CASCADE')
      table.integer('year').notNullable()
      table.integer('month').notNullable()
      table.decimal('amount', 10, 2).notNullable()
      table.text('notes').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['utility_id', 'year', 'month'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
