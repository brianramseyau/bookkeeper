<script lang="ts">
  import './layout.css'
  import favicon from '$lib/assets/favicon.svg'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { authState, loadCurrentUser, logout } from '$lib/stores/auth.svelte'
  import { registerServiceWorker } from '$lib/stores/push.svelte'
  import { themeState } from '$lib/stores/theme.svelte'
  import { Toaster } from '$lib/components/ui/sonner'
  import OutgoingsMenu from '$lib/components/nav/OutgoingsMenu.svelte'
  import AccountMenu from '$lib/components/nav/AccountMenu.svelte'
  import MobileTabBar from '$lib/components/nav/MobileTabBar.svelte'
  import { isRouteActive } from '$lib/components/nav/route-active'
  import PullToRefresh from '$lib/components/PullToRefresh.svelte'

  let { children } = $props()

  // Content width per route (matched on the path's first segment). The
  // Dashboard is a multi-panel overview that has room to spread out on wide
  // screens; every other route is a single column/table that reads better at
  // the default width. The nav bar shares the width so its contents stay
  // aligned with the page below it. Routes never set their own max-width
  // (see DESIGN.md), so a wider route is added here.
  const DEFAULT_WIDTH = 'max-w-5xl'
  const ROUTE_WIDTHS: Record<string, string> = { '': 'max-w-7xl' }
  const shellWidth = $derived(ROUTE_WIDTHS[page.url.pathname.split('/')[1] ?? ''] ?? DEFAULT_WIDTH)

  // Dashboard, Monthly and Income each answer a distinct question in
  // DESIGN.md's screen table and stay top-level; Bills/Subscriptions/
  // Expenses/Utilities all answer the same one ("what do we pay for?"), so
  // they're grouped behind OutgoingsMenu instead of four more flat links.
  const navLinks = [
    { href: '/', label: 'Dashboard' },
    { href: '/monthly', label: 'Monthly' },
    { href: '/income', label: 'Income' },
  ]

  onMount(() => {
    void loadCurrentUser()
    void registerServiceWorker()
  })

  $effect(() => {
    if (authState.loading) return

    const onLoginPage = page.url.pathname === '/login'
    if (!authState.user && !onLoginPage) {
      void goto('/login')
    } else if (authState.user && onLoginPage) {
      void goto('/')
    }
  })

  async function handleLogout() {
    await logout()
    await goto('/login')
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<PullToRefresh />

<!-- Overrides the vendored Sonner wrapper's own mode-watcher-driven theme
     (see ui/sonner/sonner.svelte) with this app's theme store - passed
     after the wrapper's default so it wins (see DESIGN.md's decisions log
     from Phase 1). top-center keeps toasts clear of the mobile bottom tab
     bar, which a bottom position would collide with. -->
<Toaster theme={themeState.current} position="top-center" />

{#if authState.loading}
  <div class="bg-background text-muted-foreground flex min-h-screen items-center justify-center">
    Loading…
  </div>
{:else if authState.user}
  <div class="bg-background min-h-screen">
    <nav aria-label="Primary" class="bg-surface border-rule border-b">
      <div class={['mx-auto flex items-center gap-6 px-4 py-3 sm:px-6', shellWidth]}>
        <a href="/" class="font-display text-foreground text-lg">Bookkeeper</a>

        <div class="hidden items-center gap-6 lg:flex">
          {#each navLinks as link (link.href)}
            {@const active = isRouteActive(page.url.pathname, link.href)}
            <a
              href={link.href}
              aria-current={active ? 'page' : undefined}
              class={[
                'text-sm font-medium whitespace-nowrap transition-colors',
                active ? 'text-violet' : 'text-muted-ink hover:text-ink',
              ]}
            >
              {link.label}
            </a>
          {/each}
          <OutgoingsMenu />
        </div>

        <div class="flex-1"></div>

        <div class="hidden lg:flex">
          <AccountMenu user={authState.user} onLogout={handleLogout} />
        </div>
      </div>
    </nav>

    <!-- pb-16 clears the fixed MobileTabBar below `lg`, plus the bar's own
         safe-area padding (see MobileTabBar.svelte) so the two move
         together - a no-op sum today (no `viewport-fit=cover` in app.html
         yet, so the env() term is 0), but correct the moment that's added.
         sm:py-8's own bottom padding is enough at lg+, where the tab bar is
         hidden. -->
    <main
      class={[
        'mx-auto px-4 pt-6 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8 lg:pb-8',
        shellWidth,
      ]}
    >
      {@render children()}
    </main>

    <MobileTabBar user={authState.user} onLogout={handleLogout} />
  </div>
{:else}
  {@render children()}
{/if}
