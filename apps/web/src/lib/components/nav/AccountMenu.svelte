<script lang="ts">
  import { page } from '$app/state'
  import {
    mdiCog,
    mdiFolderMultipleOutline,
    mdiCheckboxMarkedOutline,
    mdiWeatherNight,
    mdiWeatherSunny,
    mdiLogout,
  } from '@mdi/js'
  import type { Snippet } from 'svelte'
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '$lib/components/ui/dropdown-menu'
  import { cn } from '$lib/utils'
  import type { CurrentUser } from '$lib/stores/auth.svelte'
  import { themeState, toggleTheme } from '$lib/stores/theme.svelte'
  import { isRouteActive } from './route-active'
  import { TOUCH_MENU_ITEM } from './menu-touch'

  // Categories and Tasks are setup/admin screens, not one of DESIGN.md's
  // "answers one question" screens - grouped here with Settings rather than
  // sitting in primary nav alongside Dashboard/Monthly/Income/Outgoings.
  const LINKS = [
    { href: '/categories', label: 'Categories', path: mdiFolderMultipleOutline },
    { href: '/tasks', label: 'Tasks', path: mdiCheckboxMarkedOutline },
    { href: '/settings', label: 'Settings', path: mdiCog },
  ]

  interface Props {
    user: Pick<CurrentUser, 'fullName' | 'email' | 'displayColor' | 'initials'>
    onLogout: () => void
    /** Custom trigger - receives bits-ui's own `child`-snippet payload
        (spread `{...props}` onto the element that should open the menu,
        matching bits-ui's own `WithChild` contract), and whether the
        current route is Categories/Tasks/Settings (for active-state
        styling). Omit for the default coloured initials avatar. */
    trigger?: Snippet<[{ props: Record<string, unknown> }, active: boolean]>
  }

  let { user, onLogout, trigger }: Props = $props()

  const isActive = $derived(LINKS.some((link) => isRouteActive(page.url.pathname, link.href)))
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
          aria-label="Account menu for {user.fullName ?? user.email}"
          aria-current={isActive ? 'true' : undefined}
          title={user.fullName ?? user.email}
          class="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style="background-color: {user.displayColor ?? 'var(--muted-ink)'}"
        >
          {user.initials}
        </button>
      {/if}
    {/snippet}
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" class="w-48">
    {#each LINKS as link (link.href)}
      {@const linkActive = isRouteActive(page.url.pathname, link.href)}
      <DropdownMenuItem class={TOUCH_MENU_ITEM}>
        {#snippet child({ props }: { props: Record<string, unknown> })}
          <a
            href={link.href}
            {...props}
            aria-current={linkActive ? 'page' : undefined}
            class={cn(
              props.class as string,
              'flex w-full items-center gap-2',
              linkActive ? 'text-violet' : 'text-ink'
            )}
          >
            <svg viewBox="0 0 24 24" class="size-4 shrink-0" fill="currentColor" aria-hidden="true">
              <path d={link.path} />
            </svg>
            {link.label}
          </a>
        {/snippet}
      </DropdownMenuItem>
    {/each}
    <DropdownMenuSeparator />
    <DropdownMenuItem
      onSelect={toggleTheme}
      class={cn(
        'data-highlighted:bg-accent text-ink flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
        TOUCH_MENU_ITEM
      )}
    >
      <svg viewBox="0 0 24 24" class="size-4 shrink-0" fill="currentColor" aria-hidden="true">
        <path d={themeState.current === 'dark' ? mdiWeatherSunny : mdiWeatherNight} />
      </svg>
      {themeState.current === 'dark' ? 'Light mode' : 'Dark mode'}
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      onSelect={onLogout}
      class={cn(
        'data-highlighted:bg-accent text-ink flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
        TOUCH_MENU_ITEM
      )}
    >
      <svg viewBox="0 0 24 24" class="size-4 shrink-0" fill="currentColor" aria-hidden="true">
        <path d={mdiLogout} />
      </svg>
      Log out
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
