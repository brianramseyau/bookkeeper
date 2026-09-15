import {
  mdiPause,
  mdiPlay,
  mdiArchive,
  mdiPackageUp,
  mdiDelete,
  mdiRestore,
  mdiPencil,
} from '@mdi/js'
import {
  lifecycleActions,
  LIFECYCLE_ACTION_LABELS,
  type LifecycleAction,
  type LifecycleState,
} from '$lib/lifecycle'

export interface OutgoingMenuAction {
  label: string
  path: string
  variant?: 'neutral' | 'danger' | 'primary' | 'amber' | 'muted' | 'success'
  onclick: () => void
}

const ACTION_ICONS: Record<LifecycleAction, string> = {
  pause: mdiPause,
  resume: mdiPlay,
  archive: mdiArchive,
  unarchive: mdiPackageUp,
  restore: mdiRestore,
  delete: mdiDelete,
}

const ACTION_VARIANTS: Record<LifecycleAction, OutgoingMenuAction['variant']> = {
  pause: 'amber',
  resume: 'success',
  archive: 'muted',
  unarchive: 'success',
  restore: 'success',
  delete: 'danger',
}

/**
 * The row/detail ActionMenu items for an outgoing: always Edit, plus the
 * lifecycle transitions valid for its current state (none when the adapter
 * has no lifecycle, e.g. utilities - pass `state: null`).
 */
export function outgoingMenuActions(
  state: LifecycleState | null,
  handlers: { onEdit: () => void; onLifecycle: (action: LifecycleAction) => void }
): OutgoingMenuAction[] {
  const menu: OutgoingMenuAction[] = [
    { label: 'Edit', path: mdiPencil, variant: 'neutral', onclick: handlers.onEdit },
  ]
  if (state) {
    for (const action of lifecycleActions(state)) {
      menu.push({
        label: LIFECYCLE_ACTION_LABELS[action],
        path: ACTION_ICONS[action],
        variant: ACTION_VARIANTS[action],
        onclick: () => handlers.onLifecycle(action),
      })
    }
  }
  return menu
}
