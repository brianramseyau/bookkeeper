import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per browser/device a user has enabled push notifications on - a
 * user can have several (phone, desktop, ...), each an independent
 * `PushSubscription` from the browser's Push API.
 */
export default class extends BaseSchema {
  protected tableName = 'push_subscriptions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.text('endpoint').notNullable().unique()
      // Named to match Lucid's SnakeCaseNamingStrategy output for the model
      // attribute `p256Dh` (it splits at the digit/letter boundary as
      // `p_256_dh`, not `p256dh`) - a plain `p256dh` column here would mismatch
      // at query time even though the generated schema class reads back fine.
      table.text('p_256_dh').notNullable()
      table.text('auth').notNullable()
      table.text('user_agent').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
