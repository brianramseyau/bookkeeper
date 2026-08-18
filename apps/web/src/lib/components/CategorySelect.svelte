<script lang="ts">
  import type { Category } from '$lib/api/categories'

  interface Props {
    categories: Category[]
    value: number | string | null
    onchange: (value: string) => void
    variant?: 'form' | 'table'
  }

  let { categories, value, onchange, variant = 'form' }: Props = $props()

  // The list arrives in tree order (each parent followed by its children), so
  // a child just needs a leading indent to read as nested under its parent.
  const childPrefix = '\u00A0\u00A0\u00A0↳ '
</script>

<select
  value={value ?? ''}
  onchange={(e) => onchange(e.currentTarget.value)}
  class={variant === 'table'
    ? 'rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
    : 'rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'}
>
  <option value="">Uncategorized</option>
  {#each categories as category (category.id)}
    <option value={category.id}>
      {category.parentId === null ? category.name : childPrefix + category.name}
    </option>
  {/each}
</select>
