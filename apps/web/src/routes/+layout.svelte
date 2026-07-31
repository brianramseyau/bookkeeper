<script lang="ts">
  import './layout.css'
  import favicon from '$lib/assets/favicon.svg'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { authState, loadCurrentUser, logout } from '$lib/stores/auth.svelte'
  import { registerServiceWorker } from '$lib/stores/push.svelte'
  import ThemeToggleButton from '$lib/components/ThemeToggleButton.svelte'
  import SettingsLink from '$lib/components/SettingsLink.svelte'
  import LogoutButton from '$lib/components/LogoutButton.svelte'
  import PullToRefresh from '$lib/components/PullToRefresh.svelte'

  let { children } = $props()

  let mobileMenuOpen = $state(false)

  const navLinks = [
    { href: '/', label: 'Dashboard', exact: true },
    { href: '/monthly', label: 'Monthly' },
    { href: '/income', label: 'Income' },
    { href: '/utilities', label: 'Utilities' },
    { href: '/bills', label: 'Bills' },
    { href: '/subscriptions', label: 'Subscriptions' },
    { href: '/expenses', label: 'Expenses' },
    { href: '/categories', label: 'Categories' },
    { href: '/tasks', label: 'Tasks' },
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

  $effect(() => {
    // Close the mobile menu whenever the route changes.
    void page.url.pathname
    mobileMenuOpen = false
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

{#if authState.loading}
  <div
    class="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500"
  >
    Loading…
  </div>
{:else if authState.user}
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900">
    <nav class="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div class="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 sm:px-6">
        <a href="/" class="font-semibold text-slate-900 dark:text-slate-100">Bookkeeper</a>

        <div class="hidden items-center gap-6 lg:flex">
          {#each navLinks as link (link.href)}
            <a
              href={link.href}
              class="text-sm font-medium whitespace-nowrap transition-colors {isActive(link)
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}"
            >
              {link.label}
            </a>
          {/each}
        </div>

        <div class="flex-1"></div>

        <div class="hidden items-center gap-3 lg:flex">
          <ThemeToggleButton />
          <SettingsLink user={authState.user} />
          <LogoutButton onLogout={handleLogout} />
        </div>

        <button
          onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          class="rounded-md p-2.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {#if mobileMenuOpen}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="size-6"
            >
              <path
                d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
              />
            </svg>
          {:else}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="size-6"
            >
              <path
                fill-rule="evenodd"
                d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5A.75.75 0 0 1 2.75 9h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.75ZM2.75 14a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5H2.75Z"
                clip-rule="evenodd"
              />
            </svg>
          {/if}
        </button>
      </div>

      {#if mobileMenuOpen}
        <div class="border-t border-slate-200 px-4 py-3 lg:hidden dark:border-slate-800">
          <div class="flex flex-col gap-1">
            {#each navLinks as link (link.href)}
              <a
                href={link.href}
                class="rounded-md px-2 py-2 text-sm font-medium transition-colors {isActive(link)
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
              >
                {link.label}
              </a>
            {/each}
          </div>
          <div
            class="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800"
          >
            <div class="flex items-center gap-3">
              <ThemeToggleButton padding="p-2.5" />
              <SettingsLink user={authState.user} padding="p-2.5" />
            </div>
            <LogoutButton onLogout={handleLogout} padding="p-2.5" />
          </div>
        </div>
      {/if}
    </nav>

    <main class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {@render children()}
    </main>
  </div>
{:else}
  {@render children()}
{/if}
