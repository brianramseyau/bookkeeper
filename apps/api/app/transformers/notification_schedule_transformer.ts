import type NotificationSchedule from '#models/notification_schedule'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class NotificationScheduleTransformer extends BaseTransformer<NotificationSchedule> {
  toObject() {
    return this.pick(this.resource, ['id', 'sendHour', 'lastRunAt', 'createdAt', 'updatedAt'])
  }
}
