import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Single-row (id 1) table holding the app-generated VAPID key pair used to
 * send web push notifications - generated once on first use
 * (`webpush.generateVAPIDKeys()`) and stored here rather than in `.env`,
 * since it's app-managed state, not something the user configures or needs
 * to remember.
 */
export default class extends BaseSchema {
  protected tableName = 'push_configs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.text('public_key').notNullable()
      table.text('private_key').notNullable()
      table.text('subject').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
