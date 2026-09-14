<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity'
  import type { Snippet } from 'svelte'
  import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
  } from '$lib/components/ui/sheet'
  import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
  } from '$lib/components/ui/drawer'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    /** The form body. */
    children: Snippet
    /** Submit/cancel buttons, rendered in the sheet/drawer's footer. */
    footer?: Snippet
  }

  let { open, onOpenChange, title, description, children, footer }: Props = $props()

  // Sheet at sm and up, Drawer below it - see DESIGN.md → Layout. 640px is
  // Tailwind's own default `sm` breakpoint; Tailwind v4's CSS-based config
  // (no tailwind.config.js - see AGENTS.md) has no JS-importable theme
  // value to read this from, so it's hardcoded here. If a `sm` override is
  // ever added to layout.css's `@theme`, update this to match.
  const isDesktop = new MediaQuery('min-width: 640px')
</script>

{#if isDesktop.current}
  <Sheet {open} {onOpenChange}>
    <SheetContent class="flex flex-col gap-4">
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        {#if description}
          <SheetDescription>{description}</SheetDescription>
        {/if}
      </SheetHeader>
      <div class="flex-1 overflow-y-auto px-4">
        {@render children()}
      </div>
      {#if footer}
        <SheetFooter>{@render footer()}</SheetFooter>
      {/if}
    </SheetContent>
  </Sheet>
{:else}
  <Drawer {open} {onOpenChange}>
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>{title}</DrawerTitle>
        {#if description}
          <DrawerDescription>{description}</DrawerDescription>
        {/if}
      </DrawerHeader>
      <div class="overflow-y-auto px-4 pb-4">
        {@render children()}
      </div>
      {#if footer}
        <DrawerFooter>{@render footer()}</DrawerFooter>
      {/if}
    </DrawerContent>
  </Drawer>
{/if}
