<script lang="ts">
  import './layout.css'
  import favicon from '$lib/assets/favicon.svg'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { authState, loadCurrentUser, logout } from '$lib/stores/auth.svelte'

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
  <div class="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">
    Loading…
  </div>
{:else if authState.user}
  <div class="min-h-screen bg-slate-50">
    <nav class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
        <span class="font-semibold text-slate-900">Bookkeeper</span>
        <a
          href="/"
          class="text-sm font-medium transition-colors {page.url.pathname === '/'
            ? 'text-indigo-600'
            : 'text-slate-500 hover:text-slate-900'}"
        >
          Dashboard
        </a>
        <a
          href="/utilities"
          class="text-sm font-medium transition-colors {page.url.pathname.startsWith('/utilities')
            ? 'text-indigo-600'
            : 'text-slate-500 hover:text-slate-900'}"
        >
          Utilities
        </a>
        <a
          href="/recurring-bills"
          class="text-sm font-medium transition-colors {page.url.pathname.startsWith(
            '/recurring-bills'
          )
            ? 'text-indigo-600'
            : 'text-slate-500 hover:text-slate-900'}"
        >
          Recurring Bills
        </a>
        <div class="flex-1"></div>
        <span class="text-sm text-slate-500">
          {authState.user.fullName ?? authState.user.email}
        </span>
        <button
          onclick={handleLogout}
          class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
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
