<script lang="ts">
  interface Props {
    class?: string
  }

  let { class: className = 'mt-6' }: Props = $props()
</script>

<p class={[className, 'text-sm text-slate-400 dark:text-slate-500']}>Loading…</p>
