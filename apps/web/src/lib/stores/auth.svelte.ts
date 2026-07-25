import { api } from '$lib/api'

export interface CurrentUser {
	id: number
	fullName: string | null
	email: string
	displayColor: string | null
	initials: string
}

class AuthState {
	user = $state<CurrentUser | null>(null)
	loading = $state(true)
}

export const authState = new AuthState()

export async function loadCurrentUser(): Promise<void> {
	authState.loading = true
	try {
		authState.user = await api.get<CurrentUser>('/me')
	} catch {
		authState.user = null
	} finally {
		authState.loading = false
	}
}

export async function login(email: string, password: string): Promise<void> {
	authState.user = await api.post<CurrentUser>('/login', { email, password })
}

export async function logout(): Promise<void> {
	await api.post('/logout')
	authState.user = null
}
