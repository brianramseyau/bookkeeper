import { PushConfigSchema } from '#database/schema'

/**
 * Single household-wide row (always `id: 1`) holding the app-generated
 * VAPID key pair - see `#services/push_service`.
 */
export default class PushConfig extends PushConfigSchema {}
