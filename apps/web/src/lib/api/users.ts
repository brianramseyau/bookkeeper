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
