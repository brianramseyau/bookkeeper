import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'recurring_bills'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table
        .integer('category_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('categories')
        .onDelete('SET NULL')
      table.decimal('amount', 10, 2).notNullable()
      table
        .enum('frequency', ['monthly', 'quarterly', 'biannual', 'annual', 'custom'])
        .notNullable()
        .defaultTo('annual')
      table.integer('custom_interval_value').unsigned().nullable()
      table.enum('custom_interval_unit', ['days', 'weeks', 'months']).nullable()
      table.integer('due_day').nullable()
      table.integer('due_month').nullable()
      table.integer('due_year').nullable()
      table.date('next_due_on').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.text('notes').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
