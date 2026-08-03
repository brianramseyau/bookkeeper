/**
 * Generic "which row is being edited, and what's its draft" state - covers
 * the `editingXId`/`startEditX`/`cancelEditX` trio that otherwise recurs
 * for every independently-editable entity on a page (carryover, income
 * entries, placeholders, expenses, income sources, non-PAYG items, ...).
 *
 * `Key` identifies which row is being edited (an id, a composite string
 * key, or - for a page with only ever one editable thing, like a single
 * carryover balance - the literal `true`). `Form` is the shape of that
 * row's draft edit fields, replacing what would otherwise be one `$state`
 * per field.
 */
export class EditState<Key, Form> {
  key = $state<Key | null>(null)
  form = $state<Form | null>(null)
  saving = $state(false)

  get isEditing(): boolean {
    return this.key !== null
  }

  isEditingKey(key: Key): boolean {
    return this.key === key
  }

  start(key: Key, form: Form): void {
    this.key = key
    this.form = form
  }

  cancel(): void {
    this.key = null
    this.form = null
  }
}

export function createEditState<Key, Form>(): EditState<Key, Form> {
  return new EditState<Key, Form>()
}
