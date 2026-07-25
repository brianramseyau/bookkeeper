<script lang="ts">
  const TABLES: { key: string; label: string }[] = [
    { key: 'categories', label: 'Categories' },
    { key: 'utilities', label: 'Utilities' },
    { key: 'utility-bills', label: 'Utility bills' },
    { key: 'recurring-bills', label: 'Recurring bills' },
    { key: 'subscriptions', label: 'Personal subscriptions' },
    { key: 'category-actuals', label: 'Category actuals' },
    { key: 'income-sources', label: 'Income sources' },
    { key: 'income-entries', label: 'Income entries' },
  ]
</script>

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Export data</h1>
<p class="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
  Download your data for backup or analysis in another tool. This is a snapshot, not a live
  backup - see the README for the recommended way to back up the whole app.
</p>

<div class="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800">
  <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Everything, as JSON</h2>
  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
    A single file with every table, useful for a full backup or import into another tool.
  </p>
  <a
    href="/api/export/json"
    class="mt-3 inline-flex items-center gap-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
  >
    Download JSON
  </a>
</div>

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Individual tables, as CSV</h2>
<div class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800">
  <table class="w-full border-collapse text-sm">
    <tbody>
      {#each TABLES as table (table.key)}
        <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
          <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{table.label}</td>
          <td class="px-3 py-2 text-right">
            <a
              href="/api/export/csv/{table.key}"
              class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Download CSV
            </a>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
