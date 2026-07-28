<script lang="ts">
  interface Props {
    label: string
    tone: 'amber' | 'slate'
  }

  let { label, tone }: Props = $props()
</script>

<span
  class={[
    'ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase',
    tone === 'amber'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  ]}
>
  {label}
</span>
