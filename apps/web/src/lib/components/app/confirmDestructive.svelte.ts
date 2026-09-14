import { mount, unmount } from 'svelte'
import ConfirmDialog from './ConfirmDialog.svelte'

export interface ConfirmDestructiveOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
}

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
  return new Promise((resolve, reject) => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    let settled = false
    function settle(result: boolean) {
      if (settled) return
      settled = true
      props.open = false
      resolve(result)
      // Actual teardown waits for `onOpenChangeComplete` below, once the
      // exit animation has actually finished, rather than a fixed timer -
      // see this function's Phase 1 Kilo Code Review comment for why a
      // discarded `setTimeout` handle was a bug (uncancellable, and the
      // instance/portal/scroll-lock could outlive the caller).
    }

    const props = $state({
      ...options,
      open: true,
      onOpenChange: (next: boolean) => {
        if (!next) settle(false)
      },
      onOpenChangeComplete: (next: boolean) => {
        if (next) return
        unmount(instance)
        target.remove()
      },
      onConfirm: () => settle(true),
    })

    let instance: ReturnType<typeof mount>
    try {
      instance = mount(ConfirmDialog, { target, props })
    } catch (error) {
      target.remove()
      reject(error)
    }
  })
}
