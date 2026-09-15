<script lang="ts">
  import { page } from '$app/state'
  import { mdiChevronDown } from '@mdi/js'
  import type { Snippet } from 'svelte'
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '$lib/components/ui/dropdown-menu'
  import { cn } from '$lib/utils'
  import { isRouteActive } from './route-active'
  import { TOUCH_MENU_ITEM } from './menu-touch'

  // "Outgoings" groups every "what do we pay for?" screen (DESIGN.md's own
  // screen-question table) behind one nav entry - Bills/Subscriptions/
  // Expenses/Utilities all answer the same question, unlike Monthly or
  // Income, which each answer a distinct one and stay top-level.
  const OUTGOINGS_LINKS = [
    { href: '/bills', label: 'Bills' },
    { href: '/subscriptions', label: 'Subscriptions' },
    { href: '/expenses', label: 'Expenses' },
    { href: '/utilities', label: 'Utilities' },
  ]

  interface Props {
    /** Custom trigger - receives bits-ui's own `child`-snippet payload
        (spread `{...props}` onto the element that should open the menu,
        matching bits-ui's own `WithChild` contract so it's a drop-in for
        anyone used to that shape), and whether the current route is one of
        the four Outgoings pages (for active-state styling). Omit for the
        default text+chevron nav link. */
    trigger?: Snippet<[{ props: Record<string, unknown> }, active: boolean]>
  }

  let { trigger }: Props = $props()

  const isActive = $derived(
    OUTGOINGS_LINKS.some((link) => isRouteActive(page.url.pathname, link.href))
  )
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props }: { props: Record<string, unknown> })}
      {#if trigger}
        {@render trigger({ props }, isActive)}
      {:else}
        <button
          type="button"
          {...props}
          aria-current={isActive ? 'true' : undefined}
          class={cn(
            'flex items-center gap-1 text-sm font-medium whitespace-nowrap transition-colors',
            isActive ? 'text-violet' : 'text-muted-ink hover:text-ink'
          )}
        >
          Outgoings
          <svg viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true">
            <path d={mdiChevronDown} />
          </svg>
        </button>
      {/if}
    {/snippet}
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start" class="w-44">
    {#each OUTGOINGS_LINKS as link (link.href)}
      {@const linkActive = isRouteActive(page.url.pathname, link.href)}
      <DropdownMenuItem class={TOUCH_MENU_ITEM}>
        {#snippet child({ props }: { props: Record<string, unknown> })}
          <a
            href={link.href}
            {...props}
            aria-current={linkActive ? 'page' : undefined}
            class={cn(
              props.class as string,
              'block w-full pointer-coarse:flex pointer-coarse:items-center',
              linkActive ? 'text-violet' : 'text-ink'
            )}
          >
            {link.label}
          </a>
        {/snippet}
      </DropdownMenuItem>
    {/each}
  </DropdownMenuContent>
</DropdownMenu>
