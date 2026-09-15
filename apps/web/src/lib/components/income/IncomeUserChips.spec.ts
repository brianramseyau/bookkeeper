import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { UserSummary } from '$lib/api/users'
import IncomeUserChips from './IncomeUserChips.svelte'

const brian: UserSummary = {
  id: 1,
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: null,
  initials: 'B',
}
const ariel: UserSummary = {
  id: 2,
  fullName: 'Ariel',
  email: 'ariel@example.com',
  displayColor: null,
  initials: 'A',
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    users: [brian, ariel],
    summaries: [
      { userId: 1, fullName: 'Brian', total: 5000, count: 1 },
      { userId: 2, fullName: 'Ariel', total: 2607.82, count: 1 },
    ],
    selectedUserId: 1,
    onSelect: vi.fn(),
    ...overrides,
  }
}

describe('IncomeUserChips', () => {
  it('renders a chip per person with their monthly total', () => {
    render(IncomeUserChips, baseProps())

    expect(screen.getByText('Brian')).toBeInTheDocument()
    expect(screen.getByText('$5,000.00/mo')).toBeInTheDocument()
    expect(screen.getByText('Ariel')).toBeInTheDocument()
    expect(screen.getByText('$2,607.82/mo')).toBeInTheDocument()
  })

  it('marks the selected person as pressed', () => {
    render(IncomeUserChips, baseProps())

    expect(screen.getByRole('button', { name: /Brian/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Ariel/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onSelect with the person id', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(IncomeUserChips, baseProps({ onSelect }))

    await user.click(screen.getByRole('button', { name: /Ariel/ }))
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('falls back to the email and $0.00 when a person has no summary', () => {
    render(
      IncomeUserChips,
      baseProps({
        users: [{ ...brian, fullName: null }],
        summaries: [],
        selectedUserId: 1,
      })
    )

    expect(screen.getByText('brian@example.com')).toBeInTheDocument()
    expect(screen.getByText('$0.00/mo')).toBeInTheDocument()
  })
})
