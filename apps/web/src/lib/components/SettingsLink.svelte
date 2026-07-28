<script lang="ts">
  interface Props {
    user: { fullName: string | null; email: string; displayColor: string | null }
    padding?: 'p-1.5' | 'p-2.5'
  }

  let { user, padding = 'p-1.5' }: Props = $props()
</script>

<a
  href="/settings"
  aria-label="Settings for {user.fullName ?? user.email}"
  title={user.fullName ?? user.email}
  class={[padding, 'rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800']}
  style="color: {user.displayColor ?? '#94a3b8'}"
>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5">
    <path
      fill-rule="evenodd"
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.75-9.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 15.85A8.001 8.001 0 0 1 10 12a8.001 8.001 0 0 1 5.499 3.85A7.966 7.966 0 0 1 10 18a7.966 7.966 0 0 1-5.499-2.15Z"
      clip-rule="evenodd"
    />
  </svg>
</a>
