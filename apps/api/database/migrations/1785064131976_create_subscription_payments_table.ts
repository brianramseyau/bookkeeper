import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscription_payments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_subscription_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('user_subscriptions')
        .onDelete('CASCADE')
      table.integer('year').notNullable()
      table.integer('month').notNullable()
      table.boolean('paid').notNullable().defaultTo(false)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['user_subscription_id', 'year', 'month'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
