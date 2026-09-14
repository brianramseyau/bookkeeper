import { mount, unmount } from 'svelte'
import ConfirmDialog from './ConfirmDialog.svelte'

export interface ConfirmDestructiveOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
}

// Upper bound on how long the exit transition can plausibly take - a safety
// net for teardown, not the primary mechanism (that's `onOpenChangeComplete`
// below, which fires as soon as the transition actually finishes and
// normally cancels this first). Guards against the instance, its portal and
// bits-ui's body scroll-lock staying attached to `document.body` forever if
// bits-ui ever stops calling `onOpenChangeComplete` for some close path -
// the exact class of leak the old fixed-timer teardown was meant to bound,
// raised again in Phase 1's Kilo Code Review after the first fix.
const TEARDOWN_FALLBACK_MS = 5000

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
    let tornDown = false
    function teardown() {
      if (tornDown) return
      tornDown = true
      clearTimeout(fallbackTimer)
      unmount(instance)
      target.remove()
    }

    function settle(result: boolean) {
      if (settled) return
      settled = true
      props.open = false
      resolve(result)
      // Actual teardown normally happens via `onOpenChangeComplete` below,
      // once the exit animation has actually finished, rather than
      // unconditionally on a fixed timer - see this function's Phase 1 Kilo
      // Code Review comments for why a discarded `setTimeout` handle was a
      // bug (uncancellable, and the instance/portal/scroll-lock could
      // outlive the caller). `fallbackTimer` below is only a safety net in
      // case that callback is ever missed.
      fallbackTimer = setTimeout(teardown, TEARDOWN_FALLBACK_MS)
    }

    const props = $state({
      ...options,
      open: true,
      onOpenChange: (next: boolean) => {
        if (!next) settle(false)
      },
      onOpenChangeComplete: (next: boolean) => {
        if (!next) teardown()
      },
      onConfirm: () => settle(true),
    })

    let instance: ReturnType<typeof mount>
    let fallbackTimer: ReturnType<typeof setTimeout>
    try {
      instance = mount(ConfirmDialog, { target, props })
    } catch (error) {
      target.remove()
      reject(error)
    }
  })
}
