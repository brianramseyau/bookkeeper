import { mount, unmount } from 'svelte'
import ConfirmDialog from './ConfirmDialog.svelte'

export interface ConfirmDestructiveOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
}

// Matches AlertDialogContent's own open/close transition duration (see
// alert-dialog-content.svelte's `duration-100`) plus a little slack, so the
// exit animation gets to finish before the throwaway instance is torn down.
const CLOSE_ANIMATION_MS = 150

/**
 * Imperative replacement for the browser's native `confirm(...)` (see
 * AGENTS.md → Design rules and DESIGN.md → Interaction rules: destructive
 * actions confirm through an AlertDialog, never `confirm()`). Mounts a
 * throwaway `ConfirmDialog` instance, resolves `true`/`false` once the user
 * picks, then unmounts it - callers don't need to render or hold state for
 * a dialog themselves:
 *
 * ```ts
 * if (await confirmDestructive({ title: `Delete "${bill.name}"?` })) {
 *   await deleteBill(bill.id)
 * }
 * ```
 */
export function confirmDestructive(options: ConfirmDestructiveOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    let settled = false
    function settle(result: boolean) {
      if (settled) return
      settled = true
      props.open = false
      resolve(result)
      setTimeout(() => {
        unmount(instance)
        target.remove()
      }, CLOSE_ANIMATION_MS)
    }

    const props = $state({
      ...options,
      open: true,
      onOpenChange: (next: boolean) => {
        if (!next) settle(false)
      },
      onConfirm: () => settle(true),
    })

    const instance = mount(ConfirmDialog, { target, props })
  })
}
