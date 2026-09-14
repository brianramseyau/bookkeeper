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
  }: Props = $props()
</script>

<AlertDialog {open} {onOpenChange}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{title}</AlertDialogTitle>
      {#if description}
        <AlertDialogDescription>{description}</AlertDialogDescription>
      {/if}
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
      <AlertDialogAction variant={destructive ? 'destructive' : 'default'} onclick={onConfirm}>
        {confirmLabel}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
