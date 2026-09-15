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
  import PullToRefresh from '$lib/components/PullToRefresh.svelte'

  let { children } = $props()

  // Dashboard, Monthly and Income each answer a distinct question in
  // DESIGN.md's screen table and stay top-level; Bills/Subscriptions/
  // Expenses/Utilities all answer the same one ("what do we pay for?"), so
  // they're grouped behind OutgoingsMenu instead of four more flat links.
  const navLinks = [
    { href: '/', label: 'Dashboard', exact: true },
    { href: '/monthly', label: 'Monthly' },
    { href: '/income', label: 'Income' },
  ]

  function isActive(link: (typeof navLinks)[number]): boolean {
    return link.exact ? page.url.pathname === link.href : page.url.pathname.startsWith(link.href)
  }

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
  <div class="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
    Loading…
  </div>
{:else if authState.user}
  <div class="min-h-screen bg-background">
    <nav class="bg-surface border-rule border-b">
      <div class="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 sm:px-6">
        <a href="/" class="font-display text-lg text-foreground">Bookkeeper</a>

        <div class="hidden items-center gap-6 lg:flex">
          {#each navLinks as link (link.href)}
            <a
              href={link.href}
              class={[
                'text-sm font-medium whitespace-nowrap transition-colors',
                isActive(link) ? 'text-violet' : 'text-muted-ink hover:text-ink',
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

    <!-- pb-16 clears the fixed MobileTabBar below `lg`; sm:py-8's own
         bottom padding is enough at lg+, where the tab bar is hidden. -->
    <main class="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 lg:pb-8">
      {@render children()}
    </main>

    <MobileTabBar user={authState.user} onLogout={handleLogout} />
  </div>
{:else}
  {@render children()}
{/if}
