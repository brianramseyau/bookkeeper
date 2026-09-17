<script lang="ts">
  import { mdiAlertCircle, mdiClockOutline } from '@mdi/js'
  import Card from '$lib/components/Card.svelte'

  interface Props {
    label: string
    /** Pre-formatted (e.g. via formatCurrency) - this component doesn't
        format numbers itself. */
    value: string
    /** A short line under the value, e.g. explaining how it's derived. */
    hint?: string
    /** `positive`/`negative` colour the value (surplus/deficit, trending up
        spend, etc.); `due`/`over` colour it for a due-date status (see
        DESIGN.md's colour table) - see the "Status is never shown by colour
        alone" table for the icon each pairs with. Default leaves the value
        in ink, which is also correct for a plain money-out figure. */
    tone?: 'default' | 'positive' | 'negative' | 'due' | 'over'
    /** A leading colour swatch for an identity value (a category or
        person's own colour) - not a tone, so it composes independently. */
    dot?: string | null
  }

  let { label, value, hint, tone = 'default', dot = null }: Props = $props()

  const TONE_TEXT = {
    default: 'text-foreground',
    positive: 'text-in',
    negative: 'text-over',
    due: 'text-due',
    over: 'text-over',
  }

  // DESIGN.md: "Status is never shown by colour alone" - every non-default
  // tone also gets a glyph, not just the colour (a value pre-formatted by
  // the caller doesn't necessarily carry its own +/- sign, and the label
  // doesn't necessarily imply a direction either). Surplus/deficit get a
  // plain up/down triangle; due/over aren't directional, so they get the
  // same clock/alert icon DESIGN.md's status table pairs with those words
  // elsewhere. Every glyph is aria-hidden (a sighted-user affordance - a
  // screen reader doesn't need "up triangle"), paired with a visually-
  // hidden TONE_LABEL text so the tone itself still reaches the
  // accessibility tree, per Kilo Code Review's follow-up on the first fix.
  const TONE_GLYPH: Record<NonNullable<Props['tone']>, string | null> = {
    default: null,
    positive: '▲',
    negative: '▼',
    due: null,
    over: null,
  }
  const TONE_ICON: Record<NonNullable<Props['tone']>, string | null> = {
    default: null,
    positive: null,
    negative: null,
    due: mdiClockOutline,
    over: mdiAlertCircle,
  }
  const TONE_LABEL: Record<NonNullable<Props['tone']>, string | null> = {
    default: null,
    positive: 'Positive:',
    negative: 'Negative:',
    due: 'Due soon:',
    over: 'Overdue:',
  }
</script>

<Card class="flex flex-col p-4">
  <p class="text-muted-foreground text-xs font-medium">{label}</p>
  <p class="mt-1 flex items-center gap-1">
    {#if dot}
      <span
        class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
        style="background-color: {dot}"
        aria-hidden="true"
      ></span>
    {/if}
    {#if TONE_GLYPH[tone]}
      <span aria-hidden="true" class={['text-base leading-none', TONE_TEXT[tone]]}
        >{TONE_GLYPH[tone]}</span
      >
      <span class="sr-only">{TONE_LABEL[tone]}</span>
    {:else if TONE_ICON[tone]}
      <svg
        viewBox="0 0 24 24"
        class={['size-4 shrink-0', TONE_TEXT[tone]]}
        fill="currentColor"
        aria-hidden="true"
      >
        <path d={TONE_ICON[tone]} />
      </svg>
      <span class="sr-only">{TONE_LABEL[tone]}</span>
    {/if}
    <span class={['font-figures text-2xl font-semibold', TONE_TEXT[tone]]}>{value}</span>
  </p>
  {#if hint}
    <p class="text-muted-foreground mt-auto pt-2 text-xs">{hint}</p>
  {/if}
</Card>
