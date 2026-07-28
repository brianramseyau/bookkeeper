import { api } from '$lib/api'

export interface NotificationPreferences {
  id: number
  userId: number
  enabled: boolean
  leadDays: number
  notifyUtilityBills: boolean
  notifyRecurringBills: boolean
  notifySubscriptions: boolean
  createdAt: string
  updatedAt: string | null
}

export function getNotificationPreferences() {
  return api.get<NotificationPreferences>('/notification-preferences')
}

export interface UpdateNotificationPreferencesPayload {
  enabled: boolean
  leadDays: number
  notifyUtilityBills: boolean
  notifyRecurringBills: boolean
  notifySubscriptions: boolean
}

export function updateNotificationPreferences(payload: UpdateNotificationPreferencesPayload) {
  return api.put<NotificationPreferences>('/notification-preferences', payload)
}
