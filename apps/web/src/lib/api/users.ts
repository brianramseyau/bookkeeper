import { api } from '$lib/api'

export interface UserSummary {
  id: number
  fullName: string | null
  email: string
  displayColor: string | null
  initials: string
}

export function listUsers() {
  return api.get<UserSummary[]>('/users')
}

export function updateUser(id: number, input: { displayColor?: string | null }) {
  return api.patch<UserSummary>(`/users/${id}`, input)
}

export function changePassword(
  id: number,
  input: { currentPassword: string; newPassword: string }
) {
  return api.put<void>(`/users/${id}/password`, input)
}

export function changeEmail(id: number, input: { currentPassword: string; newEmail: string }) {
  return api.put<UserSummary>(`/users/${id}/email`, input)
}
