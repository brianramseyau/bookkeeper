<script lang="ts">
  import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from '$lib/components/ui/alert-dialog'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    /** Red destructive styling on the confirm button (deletes) vs. the
        default primary styling (a confirmation that isn't itself
        destructive). Most callers want the destructive one - see
        `confirmDestructive` below. */
    destructive?: boolean
    /** Doesn't close the dialog itself (bits-ui's AlertDialogAction doesn't,
        unlike Cancel) - call `onOpenChange(false)` here once the action is
        done, so a caller doing async work can keep it open until it
        finishes. */
    onConfirm: () => void
    /** Fires once the open/close transition has actually finished (bits-ui's
        presence-aware callback), not just when `open` flips - use this for
        teardown that must wait out the exit animation, e.g.
        `confirmDestructive`'s unmount. */
    onOpenChangeComplete?: (open: boolean) => void
  }

  let {
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    destructive = true,
    onConfirm,
    onOpenChangeComplete,
  }: Props = $props()

  let confirming = $state(false)

  $effect(() => {
    if (open) confirming = false
  })

  function handleConfirm() {
    if (confirming) return
    confirming = true
    onConfirm()
  }
</script>

<AlertDialog {open} {onOpenChange} {onOpenChangeComplete}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{title}</AlertDialogTitle>
      {#if description}
        <AlertDialogDescription>{description}</AlertDialogDescription>
      {/if}
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
      <AlertDialogAction
        variant={destructive ? 'destructive' : 'default'}
        disabled={confirming}
        onclick={handleConfirm}
      >
        {confirmLabel}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
