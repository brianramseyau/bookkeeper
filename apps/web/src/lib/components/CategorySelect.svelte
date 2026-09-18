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

  // Svelte matches a select's raw `value` against each option's raw JS value
  // (`option.__value`) with `Object.is`, so a numeric value never matches a
  // numeric `String(...)` option (or vice versa) and the select renders with
  // nothing selected. Normalise both sides to strings - see
  // `OutgoingFormSheet.svelte`'s `display()` for the longer explanation.
  const asString = (v: number | string | null) => (v === null || v === undefined ? '' : String(v))
</script>

<select
  value={asString(value)}
  onchange={(e) => onchange(e.currentTarget.value)}
  class={variant === 'table'
    ? 'border-input text-muted-foreground rounded-md border bg-transparent px-2 py-1 text-xs'
    : 'border-input rounded-md border bg-transparent px-2 py-1.5 text-sm'}
>
  <option value="">Uncategorized</option>
  {#each categories as category (category.id)}
    <option value={String(category.id)}>
      {category.parentId === null ? category.name : childPrefix + category.name}
    </option>
  {/each}
</select>
