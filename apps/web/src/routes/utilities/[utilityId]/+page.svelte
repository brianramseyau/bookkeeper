<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		listUtilities,
		getUtilityBills,
		getUtilityTrend,
		upsertUtilityBill,
		deleteUtilityBill,
		type Utility,
		type UtilityBill,
		type UtilityTrend,
	} from '$lib/api/utilities';
	import { formatCurrency, monthShortName } from '$lib/format';
	import { ApiError } from '$lib/api';

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}

	const utilityId = Number(page.params.utilityId);

	let utility = $state<Utility | null>(null);
	let bills = $state<UtilityBill[]>([]);
	let trend = $state<UtilityTrend | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let editingKey = $state<string | null>(null);
	// bind:value on a number input coerces to an actual number (NaN when empty),
	// not a string - see https://svelte.dev/docs/svelte/bind#Number-inputs
	let editingValue = $state<number>(NaN);
	let saving = $state(false);

	onMount(load);

	async function load() {
		loading = true;
		error = null;
		try {
			const [utilities, billList, trendResult] = await Promise.all([
				listUtilities(),
				getUtilityBills(utilityId),
				getUtilityTrend(utilityId),
			]);
			utility = utilities.find((u) => u.id === utilityId) ?? null;
			bills = billList;
			trend = trendResult;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Failed to load utility';
		} finally {
			loading = false;
		}
	}

	function billFor(year: number, month: number): UtilityBill | undefined {
		return bills.find((b) => b.year === year && b.month === month);
	}

	let years = $state<number[]>([]);

	$effect(() => {
		const currentYear = new Date().getFullYear();
		const fromBills = bills.map((b) => b.year);
		const all = new Set([...fromBills, currentYear]);
		years = [...all].sort((a, b) => a - b);
	});

	function addNextYear() {
		const next = (years[years.length - 1] ?? new Date().getFullYear()) + 1;
		years = [...years, next];
	}

	function cellKey(year: number, month: number) {
		return `${year}-${month}`;
	}

	function startEdit(year: number, month: number) {
		const bill = billFor(year, month);
		editingKey = cellKey(year, month);
		editingValue = bill ? bill.amount : NaN;
	}

	function cancelEdit() {
		editingKey = null;
		editingValue = NaN;
	}

	async function saveEdit(year: number, month: number) {
		if (Number.isNaN(editingValue)) {
			cancelEdit();
			return;
		}
		const amount = editingValue;
		if (!Number.isFinite(amount) || amount < 0) {
			error = 'Enter a valid amount';
			return;
		}

		saving = true;
		error = null;
		try {
			const bill = await upsertUtilityBill(utilityId, year, month, amount);
			bills = [...bills.filter((b) => !(b.year === year && b.month === month)), bill];
			trend = await getUtilityTrend(utilityId);
			cancelEdit();
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Failed to save';
		} finally {
			saving = false;
		}
	}

	async function removeCell(year: number, month: number) {
		const bill = billFor(year, month);
		if (!bill) return;
		saving = true;
		error = null;
		try {
			await deleteUtilityBill(bill.id);
			bills = bills.filter((b) => b.id !== bill.id);
			trend = await getUtilityTrend(utilityId);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Failed to delete';
		} finally {
			saving = false;
		}
	}
</script>

<div class="wrap">
	<p><a href="/utilities">← Utilities</a></p>

	{#if loading}
		<p>Loading…</p>
	{:else if !utility}
		<p class="error">Utility not found.</p>
	{:else}
		<h1>{utility.name}</h1>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		{#if trend && trend.latestAmount !== null}
			<div class="summary">
				<div>
					<span class="label">Latest</span>
					<span class="value">{formatCurrency(trend.latestAmount)}</span>
				</div>
				<div>
					<span class="label">12-month average</span>
					<span class="value">{formatCurrency(trend.average)}</span>
				</div>
				<div>
					<span class="label">Trend</span>
					<span class="value">
						{#if trend.trend === 'up'}
							<span class="up">▲ up</span>
						{:else if trend.trend === 'down'}
							<span class="down">▼ down</span>
						{:else}
							— flat
						{/if}
					</span>
				</div>
			</div>
		{/if}

		<div class="grid-scroll">
			<table>
				<thead>
					<tr>
						<th>Month</th>
						{#each years as year (year)}
							<th>{year}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each Array(12) as _, i (i)}
						{@const month = i + 1}
						<tr>
							<td class="month">{monthShortName(month)}</td>
							{#each years as year (year)}
								{@const bill = billFor(year, month)}
								{@const key = cellKey(year, month)}
								<td class="cell">
									{#if editingKey === key}
										<input
											type="number"
											step="0.01"
											min="0"
											bind:value={editingValue}
											disabled={saving}
											onblur={() => saveEdit(year, month)}
											onkeydown={(e) => {
												if (e.key === 'Enter') saveEdit(year, month);
												if (e.key === 'Escape') cancelEdit();
											}}
											use:focusOnMount
										/>
									{:else}
										<button
											type="button"
											class="cell-button"
											class:empty={!bill}
											onclick={() => startEdit(year, month)}
										>
											{bill ? formatCurrency(bill.amount) : '+'}
										</button>
										{#if bill}
											<button
												type="button"
												class="remove"
												aria-label="Remove"
												onclick={() => removeCell(year, month)}>×</button
											>
										{/if}
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<button type="button" class="add-year" onclick={addNextYear}>+ Add {years[years.length - 1] + 1}</button>
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
	.summary {
		display: flex;
		gap: 2rem;
		margin: 1rem 0 1.5rem;
	}
	.summary .label {
		display: block;
		font-size: 0.8rem;
		opacity: 0.7;
	}
	.summary .value {
		display: block;
		font-size: 1.3rem;
		font-weight: 600;
	}
	.up {
		color: #c0392b;
	}
	.down {
		color: #27ae60;
	}
	.grid-scroll {
		overflow-x: auto;
	}
	table {
		border-collapse: collapse;
		width: 100%;
	}
	th,
	td {
		border: 1px solid #ddd;
		padding: 0.35rem 0.5rem;
		text-align: center;
		white-space: nowrap;
	}
	.month {
		text-align: left;
		font-weight: 600;
	}
	.cell {
		position: relative;
	}
	.cell-button {
		width: 100%;
		border: none;
		background: none;
		cursor: pointer;
		padding: 0.25rem;
		font: inherit;
	}
	.cell-button.empty {
		opacity: 0.35;
	}
	.cell-button:hover {
		background: #f2f2f2;
	}
	.remove {
		position: absolute;
		top: 0;
		right: 0;
		border: none;
		background: none;
		cursor: pointer;
		opacity: 0.4;
		font-size: 0.75rem;
		line-height: 1;
		padding: 0.15rem 0.3rem;
	}
	.remove:hover {
		opacity: 1;
		color: #c0392b;
	}
	.cell input {
		width: 5.5rem;
		padding: 0.25rem;
		font: inherit;
	}
	.add-year {
		margin-top: 1rem;
		padding: 0.4rem 0.8rem;
		cursor: pointer;
	}
</style>
