<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { cn } from '$lib/utils'

  interface Props {
    onclick: (event: MouseEvent) => void
    /** Rarely needed - e.g. preventing an adjacent input's blur handler from firing before this click registers. */
    onmousedown?: (event: MouseEvent) => void
    disabled?: boolean
    variant?: 'neutral' | 'danger' | 'primary' | 'cancel' | 'amber' | 'muted' | 'success'
    /** Accessible name and desktop hover tooltip - always pass a specific, human-readable action, e.g. "Edit Groceries". */
    label: string
    /** An `mdi*` path constant from '@mdi/js'. */
    path: string
    class?: string
  }

  let {
    onclick,
    onmousedown,
    disabled = false,
    variant = 'neutral',
    label,
    path,
    class: className = '',
  }: Props = $props()

  // Polymer semantic tokens (see DESIGN.md → Colour) layered on the shadcn
  // "ghost" Button variant - each is already theme-aware, so no separate
  // dark: pair is needed. The base colour is muted for every variant except
  // primary, matching the old slate-400-by-default look; only the hover
  // colour signals what the action does. `primary` has no hover token: it's
  // already violet at rest (unlike the others, which are muted at rest), and
  // the ghost Button base's own hover:bg-accent already supplies the hover
  // affordance, so a same-colour `hover:text-primary` would be a no-op.
  const VARIANT_TEXT = {
    neutral: 'text-muted-foreground hover:text-foreground',
    danger: 'text-muted-foreground hover:text-destructive',
    primary: 'text-primary',
    cancel: 'text-muted-foreground hover:text-foreground',
    amber: 'text-muted-foreground hover:text-due',
    muted: 'text-muted-foreground hover:text-foreground',
    success: 'text-muted-foreground hover:text-in',
  }
</script>

<Button
  type="button"
  variant="ghost"
  size="icon"
  {onclick}
  {onmousedown}
  {disabled}
  aria-label={label}
  title={label}
  class={cn(VARIANT_TEXT[variant], className)}
>
  <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
    <path d={path} />
  </svg>
</Button>
