<script lang="ts">
  import './layout.css'
  import favicon from '$lib/assets/favicon.svg'
  import { onMount } from 'svelte'
  import { goto, replaceState, afterNavigate } from '$app/navigation'
  import { page } from '$app/state'
  import { authState, loadCurrentUser, logout } from '$lib/stores/auth.svelte'
  import { registerServiceWorker } from '$lib/stores/push.svelte'
  import { themeState } from '$lib/stores/theme.svelte'
  import { monthState } from '$lib/stores/month.svelte'
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

  // The global month picker is shown on the screens whose content is keyed
  // to a single month (Dashboard and Monthly) - not on Income (keyed to a
  // financial year) or the outgoings/setup pages, where a month control
  // would have nothing to change. The shell owns the shared `monthState`
  // (and the URL sync below) rather than each page, so stepping the month on
  // Dashboard and navigating to Monthly keeps the same month; each page
  // still renders the `MonthNavHeader` control itself.
  const MONTH_ROUTES = new Set(['', 'monthly'])
  const routeSegment = $derived(page.url.pathname.split('/')[1] ?? '')
  const showMonthPicker = $derived(MONTH_ROUTES.has(routeSegment))

  // The shared month is adopted from `?year=&month=` only when the URL is
  // authoritative: any navigation that carries explicit params (a shared link,
  // the Dashboard chart's click-through), or a browser back/forward (where the
  // URL - params or bare - is what the user asked to see). A plain in-app nav
  // link (`/`, `/monthly`) carries no params and must *not* reset the session's
  // month - that's the whole point of the global picker.
  //
  // The mirror write lives in an effect and compares against `lastWritten`,
  // which only the effect updates. That's deliberate: SvelteKit does not
  // refresh `page.url` synchronously after our own `replaceState`, and
  // `afterNavigate` reports a link's bare target URL rather than the params we
  // just wrote, so letting the two own the same variable makes them fight. The
  // current month is written as the bare route (`/monthly`), params appearing
  // only once you've stepped away. Only the month-keyed routes are touched, so
  // `/login`, `/income` and the rest keep a clean URL.
  //
  // The write waits on `routerReady`, flipped in `afterNavigate`: on the first
  // render the effect runs during hydration, before SvelteKit has initialised
  // the router, and `replaceState` throws ("Cannot call replaceState(...)
  // before router is initialized").
  let routerReady = $state(false)
  let lastWritten = ''
  afterNavigate(({ type, to }) => {
    routerReady = true
    if (!showMonthPicker || !to) return
    // Back/forward restores whatever URL the user returned to, so a bare one
    // means "the current month" and resets; forward links only adopt an
    // explicit month, leaving the session's choice alone when they carry none.
    if (type === 'popstate') {
      if (to.url.search) monthState.syncFromUrl(to.url.search)
      else monthState.goToCurrentMonth()
    } else if (to.url.search) {
      monthState.syncFromUrl(to.url.search)
    }
  })
  $effect(() => {
    if (!showMonthPicker) {
      // Off a month route: forget what we last wrote there, so re-entering
      // via a bare link re-applies the session's month instead of leaving the
      // URL bare because it matches a remembered value from the last visit.
      lastWritten = ''
      return
    }
    if (!routerReady) return
    const target = monthState.isCurrentMonth
      ? page.url.pathname
      : `${page.url.pathname}?year=${monthState.year}&month=${monthState.month}`
    if (target === lastWritten) return
    lastWritten = target
    replaceState(target, {})
  })

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
