import { UserNotificationPreferenceSchema } from '#database/schema'

/** One row per user - opt-in bill-reminder preferences (see `#services/notification_scheduler`). */
export default class UserNotificationPreference extends UserNotificationPreferenceSchema {}
