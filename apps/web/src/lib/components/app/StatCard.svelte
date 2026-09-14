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

  // DESIGN.md: "Status is never shown by colour alone" - a positive/negative
  // tone also gets a glyph, not just the colour (a value pre-formatted by
  // the caller doesn't necessarily carry its own +/- sign; see /_design's
  // "$1,240.00" with tone="positive"). aria-hidden since the surrounding
  // context (the stat's label, e.g. "Variance") already conveys the meaning
  // to a screen reader; the glyph is a sighted-user affordance only.
  const TONE_GLYPH = {
    default: null,
    positive: '▲',
    negative: '▼',
  }
</script>

<Card class="flex flex-col p-4">
  <p class="text-muted-foreground text-xs font-medium">{label}</p>
  <p class="mt-1 flex items-center gap-1">
    {#if TONE_GLYPH[tone]}
      <span aria-hidden="true" class={['text-base leading-none', TONE_TEXT[tone]]}
        >{TONE_GLYPH[tone]}</span
      >
    {/if}
    <span class={['font-figures text-2xl font-semibold', TONE_TEXT[tone]]}>{value}</span>
  </p>
  {#if hint}
    <p class="text-muted-foreground mt-auto pt-2 text-xs">{hint}</p>
  {/if}
</Card>
