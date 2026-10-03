<script lang="ts">
  import { formatCurrency } from '$lib/format'
  import SummaryStrip from '$lib/components/app/SummaryStrip.svelte'

  interface Props {
    /** Net figures for the selected financial year - see the page's ytdSummary. */
    total: number
    salary: number
    other: number
  }

  let { total, salary, other }: Props = $props()

  const figures = $derived([
    { label: 'To date', value: formatCurrency(total), tone: 'in' as const, strong: true },
    { label: 'Salary', value: formatCurrency(salary) },
    { label: 'Other', value: formatCurrency(other) },
  ])
</script>

<SummaryStrip class="bg-card mt-4" variant="roomy" {figures} />
