<script lang="ts">
  import { mdiDotsVertical } from '@mdi/js'
  import type { Snippet } from 'svelte'

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
        the current open state and a toggle function. */
    trigger?: Snippet<[open: boolean, toggle: () => void]>
  }

  let { label, actions, class: className = '', trigger }: Props = $props()

  let open = $state(false)

  function toggle() {
    open = !open
  }

  function select(action: ActionMenuItem) {
    open = false
    action.onclick()
  }

  const VARIANT_TEXT = {
    neutral: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700',
    danger: 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20',
    primary: 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30',
    cancel: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700',
    amber: 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20',
    muted: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700',
    success:
      'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20',
  }
</script>

<div class="relative inline-block {className}">
  {#if trigger}
    {@render trigger(open, toggle)}
  {:else}
    <button
      type="button"
      onclick={toggle}
      aria-label={label}
      title={label}
      aria-haspopup="true"
      aria-expanded={open}
      class="inline-flex shrink-0 items-center justify-center rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
    >
      <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
        <path d={mdiDotsVertical} />
      </svg>
    </button>
  {/if}

  {#if open}
    <button
      type="button"
      class="fixed inset-0 z-10 cursor-default"
      aria-label="Close menu"
      onclick={() => (open = false)}
    ></button>
    <div
      role="menu"
      class="absolute right-0 z-20 mt-1 w-36 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
    >
      {#each actions as action (action.label)}
        <button
          type="button"
          role="menuitem"
          disabled={action.disabled}
          onclick={() => select(action)}
          class={[
            'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60',
            VARIANT_TEXT[action.variant ?? 'neutral'],
          ]}
        >
          <svg viewBox="0 0 24 24" class="size-4 shrink-0" fill="currentColor" aria-hidden="true">
            <path d={action.path} />
          </svg>
          {action.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
