<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authState, loadCurrentUser, logout } from '$lib/stores/auth.svelte';

	let { children } = $props();

	onMount(() => {
		void loadCurrentUser();
	});

	$effect(() => {
		if (authState.loading) return;

		const onLoginPage = page.url.pathname === '/login';
		if (!authState.user && !onLoginPage) {
			void goto('/login');
		} else if (authState.user && onLoginPage) {
			void goto('/');
		}
	});

	async function handleLogout() {
		await logout();
		await goto('/login');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if authState.loading}
	<p>Loading…</p>
{:else if authState.user}
	<nav>
		<div class="brand">Bookkeeper</div>
		<a href="/" class:active={page.url.pathname === '/'}>Dashboard</a>
		<a href="/utilities" class:active={page.url.pathname.startsWith('/utilities')}>Utilities</a>
		<div class="spacer"></div>
		<span class="user">{authState.user.fullName ?? authState.user.email}</span>
		<button onclick={handleLogout}>Log out</button>
	</nav>
	<main>
		{@render children()}
	</main>
{:else}
	{@render children()}
{/if}

<style>
	nav {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 0.75rem 1.5rem;
		border-bottom: 1px solid #ddd;
		font-family: system-ui, sans-serif;
	}
	.brand {
		font-weight: 700;
	}
	nav a {
		color: inherit;
		text-decoration: none;
		opacity: 0.7;
	}
	nav a.active {
		opacity: 1;
		font-weight: 600;
	}
	.spacer {
		flex: 1;
	}
	.user {
		opacity: 0.7;
		font-size: 0.9rem;
	}
	button {
		padding: 0.35rem 0.75rem;
		cursor: pointer;
	}
	main {
		font-family: system-ui, sans-serif;
	}
</style>
