<script lang="ts">
	import { goto } from '$app/navigation';
	import { authState, logout } from '$lib/stores/auth.svelte';

	async function handleLogout() {
		await logout();
		await goto('/login');
	}
</script>

<main>
	{#if authState.user}
		<h1>Welcome, {authState.user.fullName ?? authState.user.email}</h1>
		<button onclick={handleLogout}>Log out</button>
	{/if}
</main>

<style>
	main {
		max-width: 40rem;
		margin: 4rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	button {
		padding: 0.5rem 1rem;
		font-size: 1rem;
		cursor: pointer;
	}
</style>
