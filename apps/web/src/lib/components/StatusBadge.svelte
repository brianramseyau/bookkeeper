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
    tone === 'amber' ? 'bg-due-tint text-due' : 'bg-secondary text-secondary-foreground',
  ]}
>
  {label}
</span>
