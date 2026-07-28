<script lang="ts">
  interface Props {
    message: string
    class?: string
  }

  let { message, class: className = 'mt-3' }: Props = $props()
</script>

<p class={[className, 'text-sm text-red-600 dark:text-red-400']}>{message}</p>
