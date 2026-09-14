<script lang="ts">
  import Card from '$lib/components/Card.svelte'

  interface Props {
    label: string
    /** Pre-formatted (e.g. via formatCurrency) - this component doesn't
        format numbers itself. */
    value: string
    /** A short line under the value, e.g. explaining how it's derived. */
    hint?: string
    /** `positive`/`negative` colour the value (surplus/deficit, trending up
        spend, etc.) - see DESIGN.md's colour table. Default leaves the
        value in ink, which is also correct for a plain money-out figure. */
    tone?: 'default' | 'positive' | 'negative'
  }

  let { label, value, hint, tone = 'default' }: Props = $props()

  const TONE_TEXT = {
    default: 'text-foreground',
    positive: 'text-in',
    negative: 'text-over',
  }
</script>

<Card class="flex flex-col p-4">
  <p class="text-muted-foreground text-xs font-medium">{label}</p>
  <p class={['font-figures mt-1 text-2xl font-semibold', TONE_TEXT[tone]]}>{value}</p>
  {#if hint}
    <p class="text-muted-foreground mt-auto pt-2 text-xs">{hint}</p>
  {/if}
</Card>
