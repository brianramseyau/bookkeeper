import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import DragHandle from './DragHandle.svelte'

describe('DragHandle', () => {
  it('exposes the label as an accessible name and tooltip', () => {
    const { getByRole } = render(DragHandle, { label: 'Move Groceries' })
    const handle = getByRole('button', { name: 'Move Groceries' })
    expect(handle).toHaveAttribute('title', 'Move Groceries')
  })
})
