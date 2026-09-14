<script lang="ts">
  import { mdiDotsVertical } from '@mdi/js'
  import type { Snippet } from 'svelte'
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '$lib/components/ui/dropdown-menu'
  import { cn } from '$lib/utils'

  interface ActionMenuItem {
    label: string
    path: string
    variant?: 'neutral' | 'danger' | 'primary' | 'amber' | 'muted' | 'success'
    onclick: () => void
    disabled?: boolean
  }

  interface Props {
    /** Accessible name for the trigger button, e.g. "Actions for Groceries". */
    label: string
    actions: ActionMenuItem[]
    class?: string
    /** Custom trigger rendered instead of the default ⋮ icon button. Receives
        the bits-ui trigger props to spread onto the element that should open
        the menu (`<button {...triggerProps}>`) - this keeps the underlying
        node's aria-haspopup/aria-expanded/anchor wiring intact, the same
        contract as DropdownMenuTrigger's own `child` snippet. */
    trigger?: Snippet<[triggerProps: Record<string, unknown>]>
  }

  let { label, actions, class: className = '', trigger }: Props = $props()

  function select(action: ActionMenuItem) {
    action.onclick()
  }

  // Bits-ui applies `data-highlighted` to the keyboard/pointer-focused item
  // (see dropdown-menu-item.svelte's own `focus:bg-accent` for the
  // unstyled default) - used here instead of `hover:` so a variant's tint
  // also shows during keyboard navigation, not just on mouse hover. Colours
  // are the Polymer semantic tokens (see DESIGN.md → Colour); each is
  // already theme-aware, so no separate `dark:` pair is needed.
  const VARIANT_TEXT = {
    neutral: 'text-ink data-highlighted:bg-accent',
    danger: 'text-over data-highlighted:bg-over-tint',
    primary: 'text-violet data-highlighted:bg-accent',
    cancel: 'text-ink data-highlighted:bg-accent',
    amber: 'text-due data-highlighted:bg-due-tint',
    muted: 'text-muted-ink data-highlighted:bg-accent',
    success: 'text-in data-highlighted:bg-in-tint',
  }
</script>

<DropdownMenu>
  <DropdownMenuTrigger class={className}>
    {#snippet child({ props }: { props: Record<string, unknown> })}
      {#if trigger}
        {@render trigger(props)}
      {:else}
        <button
          type="button"
          {...props}
          aria-label={label}
          title={label}
          class={cn(
            'text-muted-ink hover:bg-accent hover:text-violet inline-flex shrink-0 items-center justify-center rounded-md p-2 transition-colors',
            props.class as string | undefined
          )}
        >
          <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
            <path d={mdiDotsVertical} />
          </svg>
        </button>
      {/if}
    {/snippet}
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" class="w-36 min-w-36">
    {#each actions as action (action.label)}
      <DropdownMenuItem
        disabled={action.disabled}
        onSelect={() => select(action)}
        class={[
          'flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors data-disabled:cursor-not-allowed data-disabled:opacity-60',
          VARIANT_TEXT[action.variant ?? 'neutral'],
        ]}
      >
        <svg viewBox="0 0 24 24" class="size-4 shrink-0" fill="currentColor" aria-hidden="true">
          <path d={action.path} />
        </svg>
        {action.label}
      </DropdownMenuItem>
    {/each}
  </DropdownMenuContent>
</DropdownMenu>
