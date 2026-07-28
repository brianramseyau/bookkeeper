<script lang="ts">
  interface Props {
    message: string
    class?: string
  }

  let { message, class: className = 'mt-3' }: Props = $props()
</script>

<p class={[className, 'text-sm text-emerald-600 dark:text-emerald-400']}>{message}</p>
