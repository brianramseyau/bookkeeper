import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The new, lean Category: a pure name/color tag for bucketing costs
 * (bills, subscriptions, expenses) for future reporting - no budget/trend/
 * actuals data of its own (that's `Expense`, see the preceding rename
 * migrations). Populated from the old `categories` table's rows (now
 * `expenses`) by the next migration, not seeded here.
 */
export default class extends BaseSchema {
  protected tableName = 'categories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // Named explicitly - the default knex-generated name
      // (`categories_name_unique`) is already taken by the old `categories`
      // table's index, which SQLite kept as-is under its new `expenses`
      // name when that table was renamed a few migrations up.
      table.string('name', 120).notNullable()
      table.unique(['name'], { indexName: 'categories_tag_name_unique' })
      table.string('color', 32).nullable()
      table.integer('sort_order').notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.boolean('is_archived').notNullable().defaultTo(false)
      table.boolean('is_system').notNullable().defaultTo(false)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
