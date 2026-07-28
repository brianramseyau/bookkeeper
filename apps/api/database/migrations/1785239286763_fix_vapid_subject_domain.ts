import { BaseSchema } from '@adonisjs/lucid/schema'

const OLD_SUBJECT = 'mailto:admin@bookkeeper.local'
const NEW_SUBJECT = 'mailto:admin@example.com'

/**
 * Apple's web push service rejects VAPID JWTs whose `sub` claim points at a
 * non-resolvable domain - `web-push`'s own source warns of exactly this for
 * `localhost`, and `.local` is the same class of reserved, non-public
 * pseudo-domain - responding 403 "BadJwtToken" and silently dropping every
 * notification to iOS devices while other browsers stay unaffected. Fixes
 * the one household-wide `push_configs` row in place (rather than
 * regenerating the VAPID key pair) so already-registered device
 * subscriptions stay valid; only touches the row if it still holds the
 * original placeholder, so this is a no-op on a database that was never
 * seeded with it.
 */
export default class extends BaseSchema {
  async up() {
    await this.db
      .from('push_configs')
      .where({ id: 1, subject: OLD_SUBJECT })
      .update({ subject: NEW_SUBJECT })
  }

  async down() {
    await this.db
      .from('push_configs')
      .where({ id: 1, subject: NEW_SUBJECT })
      .update({ subject: OLD_SUBJECT })
  }
}
