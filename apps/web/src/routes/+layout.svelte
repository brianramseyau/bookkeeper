<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authState, loadCurrentUser } from '$lib/stores/auth.svelte';

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
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if authState.loading}
	<p>Loading…</p>
{:else}
	{@render children()}
{/if}
