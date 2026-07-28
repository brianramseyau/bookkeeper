import type { HttpContext } from '@adonisjs/core/http'
import { getUserNotificationPreference } from '#services/notification_scheduler'
import NotificationPreferenceTransformer from '#transformers/notification_preference_transformer'
import { updateNotificationPreferenceValidator } from '#validators/notification_preference'

export default class NotificationPreferencesController {
  async show({ auth, serialize }: HttpContext) {
    const currentUser = auth.getUserOrFail()
    const preference = await getUserNotificationPreference(currentUser.id)
    return serialize(NotificationPreferenceTransformer.transform(preference))
  }

  async update({ auth, request, serialize }: HttpContext) {
    const currentUser = auth.getUserOrFail()
    const payload = await request.validateUsing(updateNotificationPreferenceValidator)
    const preference = await getUserNotificationPreference(currentUser.id)
    preference.merge(payload)
    await preference.save()
    return serialize(NotificationPreferenceTransformer.transform(preference))
  }
}
