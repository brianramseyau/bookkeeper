<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte'
</script>

{#if authState.user}
  <h1 class="text-2xl font-semibold text-slate-900">
    Welcome, {authState.user.fullName ?? authState.user.email}
  </h1>
  <a
    href="/utilities"
    class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
  >
    View utility bills →
  </a>
{/if}
