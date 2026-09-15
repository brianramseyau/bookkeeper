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
  import { themeState, toggleTheme } from '$lib/stores/theme.svelte'

  interface AccountUser {
    fullName: string | null
    email: string
    displayColor: string | null
    initials: string
  }

  // Categories and Tasks are setup/admin screens, not one of DESIGN.md's
  // "answers one question" screens - grouped here with Settings rather than
  // sitting in primary nav alongside Dashboard/Monthly/Income/Outgoings.
  const LINKS = [
    { href: '/categories', label: 'Categories', path: mdiFolderMultipleOutline },
    { href: '/tasks', label: 'Tasks', path: mdiCheckboxMarkedOutline },
    { href: '/settings', label: 'Settings', path: mdiCog },
  ]

  interface Props {
    user: AccountUser
    onLogout: () => void
    /** Custom trigger - receives bits-ui's trigger props to spread, and
        whether the current route is Categories/Tasks/Settings (for
        active-state styling). Omit for the default coloured initials
        avatar. */
    trigger?: Snippet<[triggerProps: Record<string, unknown>, active: boolean]>
  }

  let { user, onLogout, trigger }: Props = $props()

  const isActive = $derived(LINKS.some((link) => page.url.pathname.startsWith(link.href)))
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props }: { props: Record<string, unknown> })}
      {#if trigger}
        {@render trigger(props, isActive)}
      {:else}
        <button
          type="button"
          {...props}
          aria-label="Account menu for {user.fullName ?? user.email}"
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
      <DropdownMenuItem>
        {#snippet child({ props }: { props: Record<string, unknown> })}
          <a
            href={link.href}
            {...props}
            class={[
              'data-highlighted:bg-accent flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
              page.url.pathname.startsWith(link.href) ? 'text-violet' : 'text-ink',
            ]}
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
      class="data-highlighted:bg-accent flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-ink transition-colors"
    >
      <svg viewBox="0 0 24 24" class="size-4 shrink-0" fill="currentColor" aria-hidden="true">
        <path d={themeState.current === 'dark' ? mdiWeatherSunny : mdiWeatherNight} />
      </svg>
      {themeState.current === 'dark' ? 'Light mode' : 'Dark mode'}
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      onSelect={onLogout}
      class="data-highlighted:bg-accent flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-ink transition-colors"
    >
      <svg viewBox="0 0 24 24" class="size-4 shrink-0" fill="currentColor" aria-hidden="true">
        <path d={mdiLogout} />
      </svg>
      Log out
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
