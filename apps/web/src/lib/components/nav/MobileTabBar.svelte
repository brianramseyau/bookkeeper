<script lang="ts">
  import { page } from '$app/state'
  import {
    mdiHomeOutline,
    mdiCalendarMonthOutline,
    mdiCashPlus,
    mdiCashMinus,
    mdiDotsHorizontal,
  } from '@mdi/js'
  import OutgoingsMenu from './OutgoingsMenu.svelte'
  import AccountMenu from './AccountMenu.svelte'
  import { isRouteActive } from './route-active'
  import { cn } from '$lib/utils'
  import type { CurrentUser } from '$lib/stores/auth.svelte'

  interface Props {
    user: Pick<CurrentUser, 'fullName' | 'email' | 'displayColor' | 'initials'>
    onLogout: () => void
  }

  let { user, onLogout }: Props = $props()

  // "Home", not "Dashboard" - the fuller name stays on the desktop nav link
  // (see +layout.svelte), this is the short form a five-column, ~78px-wide
  // tab needs to render on one line at 390px.
  const TABS = [
    { href: '/', label: 'Home', path: mdiHomeOutline },
    { href: '/monthly', label: 'Monthly', path: mdiCalendarMonthOutline },
    { href: '/income', label: 'Income', path: mdiCashPlus },
  ]

  const TAB_CLASS =
    'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors'
</script>

<!-- Replaces the old hamburger panel entirely below `lg` - see DESIGN.md's
     brief: "most days it's a quick look on a phone", so the five screens
     that answer the app's most common questions get one tap each, not a
     menu to open first. Reuses OutgoingsMenu/AccountMenu (built for the
     desktop nav) with tab-styled trigger snippets, rather than duplicating
     their link lists here - the same "swap the trigger, keep the menu"
     pattern ActionMenu/HelpTooltip already established in Phase 0.

     pb-[env(safe-area-inset-bottom)] is a no-op until app.html adds
     viewport-fit=cover (it doesn't yet) - +layout.svelte's <main> pairs
     the same term into its own bottom padding so the two stay consistent
     whenever that changes, rather than only one of them moving. -->
<nav
  aria-label="Primary"
  class="bg-surface border-rule fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
>
  <div class="grid grid-cols-5">
    {#each TABS as tab (tab.href)}
      {@const active = isRouteActive(page.url.pathname, tab.href)}
      <a
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        class={cn(TAB_CLASS, active ? 'text-violet' : 'text-muted-ink')}
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
          <path d={tab.path} />
        </svg>
        {tab.label}
      </a>
    {/each}
    <OutgoingsMenu mobile>
      {#snippet trigger({ props }, active)}
        <button
          type="button"
          {...props}
          aria-current={active ? 'true' : undefined}
          class={cn(TAB_CLASS, active ? 'text-violet' : 'text-muted-ink')}
        >
          <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
            <path d={mdiCashMinus} />
          </svg>
          Outgoings
        </button>
      {/snippet}
    </OutgoingsMenu>
    <AccountMenu {user} {onLogout} mobile>
      {#snippet trigger({ props }, active)}
        <button
          type="button"
          {...props}
          aria-label="More"
          aria-current={active ? 'true' : undefined}
          class={cn(TAB_CLASS, active ? 'text-violet' : 'text-muted-ink')}
        >
          <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
            <path d={mdiDotsHorizontal} />
          </svg>
          More
        </button>
      {/snippet}
    </AccountMenu>
  </div>
</nav>
