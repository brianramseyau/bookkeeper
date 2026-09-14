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
    /** Additional disable condition, ORed with the component's own
        double-click guard - it never replaces that guard, so a click still
        latches it regardless of what `pending` is doing. Omit it entirely
        for the simple case (guard resets when the dialog reopens, nothing
        else to manage). Pass it if `onConfirm` keeps the dialog open during
        async work and you want the button disabled for that whole duration:
        set it `true` while in flight, then explicitly set it back to
        `false` once the attempt ends (success or failure) - that specific
        `false` transition is what also clears the internal guard, which is
        what lets a retry happen without closing and reopening the dialog.
        Passing `false` at rest (e.g. an `isSaving` flag that starts `false`)
        is safe and does not disable the built-in guard - only an explicit
        `true` does that. */
    pending?: boolean
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
    pending,
  }: Props = $props()

  let internalPending = $state(false)
  const confirming = $derived((pending ?? false) || internalPending)

  $effect(() => {
    if (open) internalPending = false
  })

  $effect(() => {
    // An explicit `pending={false}` is the caller's "ready to retry" signal
    // - clears the internal guard too, so a caller managing `pending`
    // doesn't need a second, separate reset path. `pending === undefined`
    // (the prop omitted) intentionally does not match here, so the simple
    // no-prop case behaves exactly as if this effect didn't exist.
    if (pending === false) internalPending = false
  })

  function handleConfirm() {
    if (confirming) return
    internalPending = true
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
