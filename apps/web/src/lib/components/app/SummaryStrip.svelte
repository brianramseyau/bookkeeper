<script lang="ts">
  interface Figure {
    label: string
    /** Pre-formatted (e.g. via formatCurrency) - this component doesn't
        format numbers itself. */
    value: string
    /** Colours the value: `in` for money coming in/surplus, `over` for a
        deficit or money going wrong; default leaves it ink (correct for a
        plain money-out figure, per DESIGN.md's Colour section). */
    tone?: 'default' | 'in' | 'over'
    /** Emphasise this figure as a headline (font-semibold). */
    strong?: boolean
    /** Wash this cell's background - the Net cell's in/over tint. */
    tint?: 'in' | 'over'
  }

  interface Props {
    figures: Figure[]
    /** `compact` is Monthly's dense Income/Outgoing/Net strip; `roomy` is
        Income's larger year-to-date To date/Salary/Other row. */
    variant?: 'compact' | 'roomy'
    class?: string
  }

  let { figures, variant = 'compact', class: className = '' }: Props = $props()

  const TONE = { default: 'text-ink', in: 'text-in', over: 'text-over' }
  const TINT = { in: 'bg-in-tint', over: 'bg-over-tint' }
  const VARIANT = {
    compact: { cell: 'px-3 py-2', label: '', value: 'text-lg' },
    roomy: { cell: 'px-4 py-3', label: 'font-medium', value: 'mt-0.5 text-xl' },
  }

  // Below `sm` the figures stack into full-width label-left / amount-right
  // rows so a large currency value always has room; at `sm` and up they sit
  // side by side as divided columns (the original compact strip). A fixed
  // three-across strip with `truncate` clipped five-figure amounts on a
  // phone - see DESIGN.md's decisions log.
</script>

<dl
  class={[
    'border-rule divide-rule flex flex-col divide-y divide-solid overflow-hidden rounded-[10px] border sm:flex-row sm:divide-x sm:divide-y-0',
    className,
  ]}
>
  {#each figures as figure (figure.label)}
    <div
      class={[
        'flex min-w-0 items-center justify-between gap-3 sm:block sm:flex-1',
        VARIANT[variant].cell,
        figure.tint ? TINT[figure.tint] : '',
      ]}
    >
      <dt class={['text-muted-foreground text-xs', VARIANT[variant].label]}>{figure.label}</dt>
      <dd
        class={[
          'font-figures',
          VARIANT[variant].value,
          figure.strong ? 'font-semibold' : '',
          TONE[figure.tone ?? 'default'],
        ]}
      >
        {figure.value}
      </dd>
    </div>
  {/each}
</dl>
