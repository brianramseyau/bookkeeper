import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'income_entries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('income_source_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('income_sources')
        .onDelete('SET NULL')
      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.integer('year').notNullable()
      table.integer('month').notNullable()
      table.date('received_on').nullable()
      table.decimal('amount', 10, 2).notNullable()
      table.string('note').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['year', 'month'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
