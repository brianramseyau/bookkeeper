import { api } from '$lib/api'

export interface NotificationSchedule {
  id: number
  sendHour: number
  lastRunAt: string | null
  createdAt: string
  updatedAt: string | null
}

export function getNotificationSchedule() {
  return api.get<NotificationSchedule>('/notification-schedule')
}

export interface UpdateNotificationSchedulePayload {
  sendHour: number
}

export function updateNotificationSchedule(payload: UpdateNotificationSchedulePayload) {
  return api.put<NotificationSchedule>('/notification-schedule', payload)
}
