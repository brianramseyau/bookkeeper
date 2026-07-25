<script lang="ts">
	import { onMount } from 'svelte';
	import { listUtilities, getUtilityTrend, createUtility, type Utility, type UtilityTrend } from '$lib/api/utilities';
	import { formatCurrency, monthName } from '$lib/format';
	import { ApiError } from '$lib/api';

	interface Row {
		utility: Utility;
		trend: UtilityTrend | null;
	}

	let rows = $state<Row[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let newUtilityName = $state('');
	let creating = $state(false);

	onMount(load);

	async function load() {
		loading = true;
		error = null;
		try {
			const utilities = await listUtilities();
			const trends = await Promise.all(utilities.map((u) => getUtilityTrend(u.id)));
			rows = utilities.map((utility, i) => ({ utility, trend: trends[i] ?? null }));
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Failed to load utilities';
		} finally {
			loading = false;
		}
	}

	async function handleAdd(event: SubmitEvent) {
		event.preventDefault();
		if (!newUtilityName.trim()) return;
		creating = true;
		error = null;
		try {
			await createUtility(newUtilityName.trim());
			newUtilityName = '';
			await load();
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Failed to add utility';
		} finally {
			creating = false;
		}
	}
</script>

<div class="wrap">
	<h1>Utilities</h1>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	{#if loading}
		<p>Loading…</p>
	{:else}
		<div class="cards">
			{#each rows as row (row.utility.id)}
				<a class="card" href={`/utilities/${row.utility.id}`}>
					<h2>{row.utility.name}</h2>
					{#if row.trend && row.trend.latestAmount !== null}
						<p class="latest">
							{formatCurrency(row.trend.latestAmount)}
							<span class="period">
								{monthName(row.trend.latestMonth ?? 0)}
								{row.trend.latestYear}
							</span>
						</p>
						<p class="average">12-mo avg: {formatCurrency(row.trend.average)}</p>
						{#if row.trend.trend === 'up'}
							<p class="trend up">▲ up on trailing average</p>
						{:else if row.trend.trend === 'down'}
							<p class="trend down">▼ down on trailing average</p>
						{:else if row.trend.trend === 'flat'}
							<p class="trend flat">— flat</p>
						{/if}
					{:else}
						<p class="latest">No bills recorded yet</p>
					{/if}
				</a>
			{/each}
		</div>

		<form onsubmit={handleAdd}>
			<input type="text" placeholder="Add a utility (e.g. Internet)" bind:value={newUtilityName} />
			<button type="submit" disabled={creating}>{creating ? 'Adding…' : 'Add utility'}</button>
		</form>
	{/if}
</div>

<style>
	.wrap {
		max-width: 60rem;
		margin: 2rem auto;
		padding: 0 1rem;
	}
	.error {
		color: #c0392b;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 1rem;
		margin: 1.5rem 0;
	}
	.card {
		display: block;
		border: 1px solid #ddd;
		border-radius: 0.5rem;
		padding: 1rem;
		text-decoration: none;
		color: inherit;
	}
	.card:hover {
		border-color: #999;
	}
	.card h2 {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
	}
	.latest {
		font-size: 1.4rem;
		font-weight: 600;
		margin: 0.25rem 0;
	}
	.period {
		font-size: 0.85rem;
		font-weight: 400;
		opacity: 0.7;
	}
	.average {
		margin: 0.25rem 0;
		opacity: 0.75;
		font-size: 0.9rem;
	}
	.trend {
		margin: 0.5rem 0 0;
		font-size: 0.9rem;
	}
	.trend.up {
		color: #c0392b;
	}
	.trend.down {
		color: #27ae60;
	}
	form {
		display: flex;
		gap: 0.5rem;
		margin-top: 1.5rem;
	}
	input {
		padding: 0.5rem;
		font-size: 1rem;
		flex: 1;
		max-width: 20rem;
	}
	button {
		padding: 0.5rem 1rem;
		cursor: pointer;
	}
</style>
