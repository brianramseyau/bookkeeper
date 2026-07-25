<script lang="ts">
  import './layout.css'
  import favicon from '$lib/assets/favicon.svg'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { authState, loadCurrentUser, logout } from '$lib/stores/auth.svelte'
  import { themeState, toggleTheme } from '$lib/stores/theme.svelte'

  let { children } = $props()

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
      <div class="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
        <span class="font-semibold text-slate-900 dark:text-slate-100">Bookkeeper</span>
        <a
          href="/"
          class="text-sm font-medium transition-colors {page.url.pathname === '/'
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}"
        >
          Dashboard
        </a>
        <a
          href="/utilities"
          class="text-sm font-medium transition-colors {page.url.pathname.startsWith('/utilities')
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}"
        >
          Utilities
        </a>
        <a
          href="/recurring-bills"
          class="text-sm font-medium transition-colors {page.url.pathname.startsWith(
            '/recurring-bills'
          )
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}"
        >
          Recurring Bills
        </a>
        <a
          href="/subscriptions"
          class="text-sm font-medium transition-colors {page.url.pathname.startsWith(
            '/subscriptions'
          )
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}"
        >
          Subscriptions
        </a>
        <a
          href="/categories"
          class="text-sm font-medium transition-colors {page.url.pathname.startsWith('/categories')
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}"
        >
          Categories
        </a>
        <a
          href="/month"
          class="text-sm font-medium transition-colors {page.url.pathname.startsWith('/month')
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}"
        >
          Standard Month
        </a>
        <div class="flex-1"></div>
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
        <span class="text-sm text-slate-500 dark:text-slate-400">
          {authState.user.fullName ?? authState.user.email}
        </span>
        <button
          onclick={handleLogout}
          class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Log out
        </button>
      </div>
    </nav>

    <main class="mx-auto max-w-5xl px-6 py-8">
      {@render children()}
    </main>
  </div>
{:else}
  {@render children()}
{/if}
