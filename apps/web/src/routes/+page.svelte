<script lang="ts">
	import { authState } from '$lib/stores/auth.svelte';
</script>

<div class="wrap">
	{#if authState.user}
		<h1>Welcome, {authState.user.fullName ?? authState.user.email}</h1>
		<p><a href="/utilities">View utility bills →</a></p>
	{/if}
</div>

<style>
	.wrap {
		max-width: 40rem;
		margin: 2rem auto;
		padding: 0 1rem;
	}
</style>
