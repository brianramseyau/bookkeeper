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

  // Sheet at sm (640px) and up, Drawer below it - see DESIGN.md → Layout.
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
