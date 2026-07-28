import type { HttpContext } from '@adonisjs/core/http'
import { getNotificationSchedule } from '#services/notification_scheduler'
import NotificationScheduleTransformer from '#transformers/notification_schedule_transformer'
import { updateNotificationScheduleValidator } from '#validators/notification_schedule'

export default class NotificationSchedulesController {
  async show({ serialize }: HttpContext) {
    const schedule = await getNotificationSchedule()
    return serialize(NotificationScheduleTransformer.transform(schedule))
  }

  async update({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(updateNotificationScheduleValidator)
    const schedule = await getNotificationSchedule()
    schedule.merge(payload)
    await schedule.save()
    return serialize(NotificationScheduleTransformer.transform(schedule))
  }
}
