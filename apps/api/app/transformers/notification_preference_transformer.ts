import type UserNotificationPreference from '#models/user_notification_preference'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class NotificationPreferenceTransformer extends BaseTransformer<UserNotificationPreference> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'userId', 'leadDays', 'createdAt', 'updatedAt']),
      // SQLite has no native boolean type - a row just read back from the DB
      // (rather than set in this same JS process) carries the raw 0/1 it's
      // stored as, so coerce to real booleans at the API boundary.
      enabled: Boolean(this.resource.enabled),
      notifyUtilityBills: Boolean(this.resource.notifyUtilityBills),
      notifyRecurringBills: Boolean(this.resource.notifyRecurringBills),
      notifySubscriptions: Boolean(this.resource.notifySubscriptions),
    }
  }
}
