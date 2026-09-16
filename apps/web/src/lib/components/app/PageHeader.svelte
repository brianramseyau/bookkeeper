<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    /** The page's h1. Rendered in the display type role (see DESIGN.md →
        Type) - the display face is reserved for page titles and the month
        strip's headline figure, nowhere else. */
    title: string
    /** A short lead paragraph under the title, e.g. explaining what the
        page is for. */
    description?: string
    /** A detail page's "← Back to X" link, shown above the title. */
    back?: { href: string; label: string }
    /** The document/tab title, when it differs from the visible h1 (the
        Dashboard's h1 greets the signed-in person, but the tab should read
        "Dashboard"). Defaults to `title`. */
    documentTitle?: string
    /** Buttons/menus for this page, right-aligned next to the title on
        desktop and wrapped below it on mobile. */
    actions?: Snippet
  }

  let { title, description, back, documentTitle, actions }: Props = $props()
</script>

<svelte:head>
  <title>{documentTitle ?? title} · Bookkeeper</title>
</svelte:head>

<div>
  {#if back}
    <a
      href={back.href}
      class="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
    >
      ← {back.label}
    </a>
  {/if}
  <div
    class={['flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', back && 'mt-1']}
  >
    <h1 class="font-display text-foreground text-2xl">{title}</h1>
    {#if actions}
      <div class="flex shrink-0 items-center justify-end gap-2">
        {@render actions()}
      </div>
    {/if}
  </div>
  {#if description}
    <p class="text-muted-foreground mt-1 text-sm">{description}</p>
  {/if}
</div>
