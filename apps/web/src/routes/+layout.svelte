<script lang="ts">
  import './layout.css'
  import favicon from '$lib/assets/favicon.svg'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { authState, loadCurrentUser, logout } from '$lib/stores/auth.svelte'
  import { themeState, toggleTheme } from '$lib/stores/theme.svelte'

  let { children } = $props()

  let mobileMenuOpen = $state(false)

  const navLinks = [
    { href: '/', label: 'Dashboard', exact: true },
    { href: '/month', label: 'Monthly' },
    { href: '/utilities', label: 'Utilities' },
    { href: '/recurring-bills', label: 'Recurring Bills' },
    { href: '/subscriptions', label: 'Subscriptions' },
    { href: '/categories', label: 'Categories' },
    { href: '/export', label: 'Export' },
  ]

  function isActive(link: (typeof navLinks)[number]): boolean {
    return link.exact ? page.url.pathname === link.href : page.url.pathname.startsWith(link.href)
  }

  onMount(() => {
    void loadCurrentUser()
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
        <span class="font-semibold text-slate-900 dark:text-slate-100">Bookkeeper</span>

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
          <button
            onclick={toggleTheme}
            aria-label="Toggle dark mode"
            class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            {#if themeState.current === 'dark'}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="size-5"
              >
                <path
                  d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 1 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM5.404 6.464a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 1 0-1.061 1.06l1.06 1.06Z"
                />
              </svg>
            {:else}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="size-5"
              >
                <path
                  fill-rule="evenodd"
                  d="M17.293 13.293A8 8 0 0 1 6.707 2.707a8.001 8.001 0 1 0 10.586 10.586Z"
                  clip-rule="evenodd"
                />
              </svg>
            {/if}
          </button>
          <a
            href="/settings"
            class="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10 dark:border-white/10"
              style="background-color: {authState.user.displayColor ?? '#94a3b8'}"
            ></span>
            {authState.user.fullName ?? authState.user.email}
          </a>
          <button
            onclick={handleLogout}
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Log out
          </button>
        </div>

        <button
          onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {#if mobileMenuOpen}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-6">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-6">
              <path fill-rule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5A.75.75 0 0 1 2.75 9h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.75ZM2.75 14a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5H2.75Z" clip-rule="evenodd" />
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
              <button
                onclick={toggleTheme}
                aria-label="Toggle dark mode"
                class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                {#if themeState.current === 'dark'}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    class="size-5"
                  >
                    <path
                      d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 1 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM5.404 6.464a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 1 0-1.061 1.06l1.06 1.06Z"
                    />
                  </svg>
                {:else}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    class="size-5"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M17.293 13.293A8 8 0 0 1 6.707 2.707a8.001 8.001 0 1 0 10.586 10.586Z"
                      clip-rule="evenodd"
                    />
                  </svg>
                {/if}
              </button>
              <a
                href="/settings"
                class="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                  style="background-color: {authState.user.displayColor ?? '#94a3b8'}"
                ></span>
                {authState.user.fullName ?? authState.user.email}
              </a>
            </div>
            <button
              onclick={handleLogout}
              class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Log out
            </button>
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
