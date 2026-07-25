<script lang="ts">
	import { goto } from '$app/navigation';
	import { login } from '$lib/stores/auth.svelte';
	import { ApiError } from '$lib/api';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let submitting = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		submitting = true;
		try {
			await login(email, password);
			await goto('/');
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Something went wrong, try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<main>
	<h1>Bookkeeper</h1>
	<form onsubmit={handleSubmit}>
		<label>
			Email
			<input type="email" bind:value={email} autocomplete="email" required />
		</label>
		<label>
			Password
			<input type="password" bind:value={password} autocomplete="current-password" required />
		</label>
		{#if error}
			<p class="error">{error}</p>
		{/if}
		<button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
	</form>
</main>

<style>
	main {
		max-width: 24rem;
		margin: 4rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	input {
		padding: 0.5rem;
		font-size: 1rem;
	}
	.error {
		color: #c0392b;
	}
	button {
		padding: 0.6rem;
		font-size: 1rem;
		cursor: pointer;
	}
</style>
