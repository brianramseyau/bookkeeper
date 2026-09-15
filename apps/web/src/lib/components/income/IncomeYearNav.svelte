<script lang="ts">
  import { currentFinancialYear, financialYearLabel } from '$lib/format'
  import { Button } from '$lib/components/ui/button'

  interface Props {
    /** The financial year's end year - see financialYearLabel. */
    financialYear: number
    onChange: (delta: number) => void
  }

  let { financialYear, onChange }: Props = $props()

  const atCurrentYear = $derived(financialYear >= currentFinancialYear())
</script>

<div class="flex items-center gap-3">
  <Button type="button" variant="outline" onclick={() => onChange(-1)}>← Prev</Button>
  <span class="text-foreground w-32 text-center text-sm font-medium">
    {financialYearLabel(financialYear)}
  </span>
  <Button type="button" variant="outline" disabled={atCurrentYear} onclick={() => onChange(1)}>
    Next →
  </Button>
</div>
