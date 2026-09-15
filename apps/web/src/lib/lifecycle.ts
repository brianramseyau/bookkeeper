/**
 * The shared lifecycle model for "outgoing" entities (bills, subscriptions,
 * expenses). Every one of them carries the same three flags - `isActive`,
 * `isPaused`, `isArchived` - and moves through the same four visible states,
 * so the derivation and the allowed transition set live here rather than
 * being re-declared on each list page (see AGENTS.md's DRY note).
 *
 * Utilities are the exception: they only have `isActive`, no pause/archive,
 * so a utility is always either `active` or `removed` (see the lifecycle
 * guardrails in PLAN_01_PHASE_03_UNIFIED_OUTGOINGS.md).
 */
export type LifecycleState = 'active' | 'paused' | 'archived' | 'removed'

export type LifecycleAction = 'pause' | 'resume' | 'archive' | 'unarchive' | 'restore' | 'delete'

export interface LifecycleFlags {
  isActive: boolean
  isPaused?: boolean
  isArchived?: boolean
}

const STATE_ORDER: LifecycleState[] = ['active', 'paused', 'archived', 'removed']

export const LIFECYCLE_STATE_LABELS: Record<LifecycleState, string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
  removed: 'Removed',
}

export const LIFECYCLE_ACTION_LABELS: Record<LifecycleAction, string> = {
  pause: 'Pause',
  resume: 'Resume',
  archive: 'Archive',
  unarchive: 'Unarchive',
  restore: 'Restore',
  delete: 'Delete',
}

/** The verb a toast repeats after the action, e.g. "Bill paused". */
export const LIFECYCLE_ACTION_TOASTS: Record<LifecycleAction, string> = {
  pause: 'paused',
  resume: 'resumed',
  archive: 'archived',
  unarchive: 'unarchived',
  restore: 'restored',
  delete: 'deleted',
}

const ACTIONS_BY_STATE: Record<LifecycleState, LifecycleAction[]> = {
  // A paused item can be resumed, or archived (archiving clears the pause).
  active: ['pause', 'archive'],
  paused: ['resume', 'archive'],
  // Deleting is only ever offered on an archived item - the API rejects a
  // hard delete otherwise (see each controller's `destroy`).
  archived: ['unarchive', 'delete'],
  removed: ['restore'],
}

/**
 * A single item's visible state. `isActive = false` wins outright ("removed"),
 * matching how the API treats a soft-deleted row; an inactive item can't also
 * be paused/archived in the UI's eyes.
 */
export function lifecycleState(item: LifecycleFlags): LifecycleState {
  if (!item.isActive) return 'removed'
  if (item.isArchived) return 'archived'
  if (item.isPaused) return 'paused'
  return 'active'
}

/** The actions offered for an item in `state`, in the order they render. */
export function lifecycleActions(state: LifecycleState): LifecycleAction[] {
  return ACTIONS_BY_STATE[state]
}

/**
 * The PATCH body a lifecycle action sends. `delete` has no field changes - it
 * maps to the entity's DELETE route instead, so it returns an empty object.
 */
export function lifecyclePatch(action: LifecycleAction): Partial<LifecycleFlags> {
  switch (action) {
    case 'pause':
      return { isPaused: true }
    case 'resume':
      return { isPaused: false }
    case 'archive':
      return { isArchived: true }
    case 'unarchive':
      return { isArchived: false }
    case 'restore':
      return { isActive: true }
    case 'delete':
      return {}
  }
}

export interface LifecycleGroup<T> {
  state: LifecycleState
  label: string
  items: T[]
}

/** All four states, in fixed order, with their items - empty groups included so tabs keep a stable order. */
export function groupByLifecycle<T extends LifecycleFlags>(items: T[]): LifecycleGroup<T>[] {
  return STATE_ORDER.map((state) => ({
    state,
    label: LIFECYCLE_STATE_LABELS[state],
    items: items.filter((item) => lifecycleState(item) === state),
  }))
}
