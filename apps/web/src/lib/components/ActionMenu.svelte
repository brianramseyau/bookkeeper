<script lang="ts">
  import { mdiDotsVertical } from '@mdi/js'
  import type { Snippet } from 'svelte'
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '$lib/components/ui/dropdown-menu'

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
  // also shows during keyboard navigation, not just on mouse hover.
  const VARIANT_TEXT = {
    neutral:
      'text-slate-700 data-highlighted:bg-slate-100 dark:text-slate-200 dark:data-highlighted:bg-slate-700',
    danger:
      'text-red-600 data-highlighted:bg-red-50 dark:text-red-400 dark:data-highlighted:bg-red-900/20',
    primary:
      'text-indigo-600 data-highlighted:bg-indigo-50 dark:text-indigo-400 dark:data-highlighted:bg-indigo-900/30',
    cancel:
      'text-slate-700 data-highlighted:bg-slate-100 dark:text-slate-200 dark:data-highlighted:bg-slate-700',
    amber:
      'text-amber-600 data-highlighted:bg-amber-50 dark:text-amber-400 dark:data-highlighted:bg-amber-900/20',
    muted:
      'text-slate-700 data-highlighted:bg-slate-100 dark:text-slate-200 dark:data-highlighted:bg-slate-700',
    success:
      'text-emerald-600 data-highlighted:bg-emerald-50 dark:text-emerald-400 dark:data-highlighted:bg-emerald-900/20',
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
          class="inline-flex shrink-0 items-center justify-center rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
        >
          <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
            <path d={mdiDotsVertical} />
          </svg>
        </button>
      {/if}
    {/snippet}
  </DropdownMenuTrigger>
  <DropdownMenuContent
    align="end"
    class="w-36 min-w-36 rounded-md border border-slate-200 bg-white p-1 py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
  >
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
