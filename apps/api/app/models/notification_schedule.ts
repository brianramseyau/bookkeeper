import { NotificationScheduleSchema } from '#database/schema'

/**
 * Single household-wide row (always `id: 1`, see `NotificationScheduler`)
 * holding when the shared daily bill-reminder check runs.
 */
export default class NotificationSchedule extends NotificationScheduleSchema {}
