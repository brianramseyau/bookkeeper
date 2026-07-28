import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import type { IncomeSource } from '$lib/api/income'
import type { UserSummary } from '$lib/api/users'
import IncomeEntryForm from './IncomeEntryForm.svelte'

const sources: IncomeSource[] = [
  {
    id: 1,
    userId: 1,
    name: 'Salary',
    expectedAmount: 1000,
    frequency: 'monthly',
    payDayOfMonth: 1,
    weekendRollback: false,
    anchorDate: null,
    taxWithheld: true,
    isActive: true,
    notes: null,
  },
]

const users: UserSummary[] = [
  { id: 1, fullName: 'Brian', email: 'brian@example.com', displayColor: '#4f46e5', initials: 'B' },
]

const multiUserSources: IncomeSource[] = [
  ...sources,
  {
    id: 2,
    userId: 2,
    name: 'Freelance',
    expectedAmount: 500,
    frequency: 'monthly',
    payDayOfMonth: 15,
    weekendRollback: false,
    anchorDate: null,
    taxWithheld: false,
    isActive: true,
    notes: null,
  },
]

const multiUsers: UserSummary[] = [
  ...users,
  { id: 2, fullName: 'Alex', email: 'alex@example.com', displayColor: '#0ea5e9', initials: 'A' },
]

describe('IncomeEntryForm', () => {
  it('defaults to submitting the first source when unattributed is not allowed', async () => {
    // jsdom doesn't mark a <select>'s freshly-mounted option as selected in
    // the same synchronous flush as a bound initial value (a <select>
    // rendering quirk, not something specific to this component - the same
    // <select bind:value> + reactive #each pattern is used unmodified from
    // the original Income/Month pages) - so assert the bound value drives a
    // correct submission rather than the DOM's cosmetic selectedness.
    const onSubmit = vi.fn().mockResolvedValue(true)
    const { container } = render(IncomeEntryForm, { sources, submitting: false, onSubmit })
    const amountInput = container.querySelector('input[type="number"]')!
    await fireEvent.input(amountInput, { target: { value: '250' } })
    await fireEvent.submit(container.querySelector('form')!)
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ incomeSourceId: 1 }))
  })

  it('does not show an Unattributed option when allowUnattributed is false', () => {
    const { queryByText } = render(IncomeEntryForm, {
      sources,
      submitting: false,
      onSubmit: vi.fn(),
    })
    expect(queryByText('Unattributed')).toBeNull()
  })

  it('submits the source-attributed values on submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    const { container } = render(IncomeEntryForm, { sources, submitting: false, onSubmit })
    const amountInput = container.querySelector('input[type="number"]')!
    await fireEvent.input(amountInput, { target: { value: '250' } })
    const form = container.querySelector('form')!
    await fireEvent.submit(form)
    expect(onSubmit).toHaveBeenCalledWith({
      incomeSourceId: 1,
      userId: null,
      amount: 250,
      receivedOn: null,
      note: null,
      taxWithheld: null,
    })
  })

  it('resets its fields after a successful submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    const { container } = render(IncomeEntryForm, { sources, submitting: false, onSubmit })
    const amountInput = container.querySelector('input[type="number"]') as HTMLInputElement
    await fireEvent.input(amountInput, { target: { value: '250' } })
    await fireEvent.submit(container.querySelector('form')!)
    expect(amountInput.value).toBe('')
  })

  it('keeps its fields when the submit fails', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false)
    const { container } = render(IncomeEntryForm, { sources, submitting: false, onSubmit })
    const amountInput = container.querySelector('input[type="number"]') as HTMLInputElement
    await fireEvent.input(amountInput, { target: { value: '250' } })
    await fireEvent.submit(container.querySelector('form')!)
    expect(amountInput.value).toBe('250')
  })

  it('shows an Unattributed option and defaults to showing person/tax fields', () => {
    const { getByText } = render(IncomeEntryForm, {
      sources,
      users,
      allowUnattributed: true,
      submitting: false,
      onSubmit: vi.fn(),
    })
    expect(getByText('Unattributed')).toBeInTheDocument()
    expect(getByText('Person')).toBeInTheDocument()
    expect(getByText('Tax withheld')).toBeInTheDocument()
  })

  it('keeps the person field visible once a source is selected', async () => {
    const { container, queryByText } = render(IncomeEntryForm, {
      sources,
      users,
      allowUnattributed: true,
      submitting: false,
      onSubmit: vi.fn(),
    })
    const personSelect = container.querySelectorAll('select')[0] as HTMLSelectElement
    await fireEvent.change(personSelect, { target: { value: '1' } })
    const sourceSelect = container.querySelectorAll('select')[1] as HTMLSelectElement
    await fireEvent.change(sourceSelect, { target: { value: '1' } })
    expect(queryByText('Person')).not.toBeNull()
  })

  it('only offers Unattributed as a source until a person is selected', () => {
    const { getByText, queryByText } = render(IncomeEntryForm, {
      sources: multiUserSources,
      users: multiUsers,
      allowUnattributed: true,
      submitting: false,
      onSubmit: vi.fn(),
    })
    expect(getByText('Unattributed')).toBeInTheDocument()
    expect(queryByText('Salary')).toBeNull()
    expect(queryByText('Freelance')).toBeNull()
  })

  it("narrows the source dropdown to the selected person's own sources", async () => {
    const { container, getByText, queryByText } = render(IncomeEntryForm, {
      sources: multiUserSources,
      users: multiUsers,
      allowUnattributed: true,
      submitting: false,
      onSubmit: vi.fn(),
    })
    const personSelect = container.querySelectorAll('select')[0] as HTMLSelectElement
    await fireEvent.change(personSelect, { target: { value: '1' } })
    expect(getByText('Salary')).toBeInTheDocument()
    expect(queryByText('Freelance')).toBeNull()
  })

  it('resets a previously selected source when the person changes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    const { container } = render(IncomeEntryForm, {
      sources: multiUserSources,
      users: multiUsers,
      allowUnattributed: true,
      submitting: false,
      onSubmit,
    })
    const personSelect = container.querySelectorAll('select')[0] as HTMLSelectElement
    await fireEvent.change(personSelect, { target: { value: '1' } })
    const sourceSelect = container.querySelectorAll('select')[1] as HTMLSelectElement
    await fireEvent.change(sourceSelect, { target: { value: '1' } })
    await fireEvent.change(personSelect, { target: { value: '2' } })
    expect((sourceSelect as HTMLSelectElement).value).toBe('')
  })

  it('submits an unattributed entry with the selected person and tax flag', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    const { container } = render(IncomeEntryForm, {
      sources,
      users,
      allowUnattributed: true,
      submitting: false,
      onSubmit,
    })
    const personSelect = container.querySelectorAll('select')[0]!
    await fireEvent.change(personSelect, { target: { value: '1' } })
    const checkbox = container.querySelector('input[type="checkbox"]')!
    await fireEvent.click(checkbox)
    const amountInput = container.querySelector('input[type="number"]')!
    await fireEvent.input(amountInput, { target: { value: '80' } })
    await fireEvent.submit(container.querySelector('form')!)
    expect(onSubmit).toHaveBeenCalledWith({
      incomeSourceId: null,
      userId: 1,
      amount: 80,
      receivedOn: null,
      note: null,
      taxWithheld: true,
    })
  })

  it('submits a source-attributed entry once a person and their own source are selected', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    const { container } = render(IncomeEntryForm, {
      sources: multiUserSources,
      users: multiUsers,
      allowUnattributed: true,
      submitting: false,
      onSubmit,
    })
    const personSelect = container.querySelectorAll('select')[0]!
    await fireEvent.change(personSelect, { target: { value: '2' } })
    const sourceSelect = container.querySelectorAll('select')[1]!
    await fireEvent.change(sourceSelect, { target: { value: '2' } })
    const amountInput = container.querySelector('input[type="number"]')!
    await fireEvent.input(amountInput, { target: { value: '80' } })
    await fireEvent.submit(container.querySelector('form')!)
    expect(onSubmit).toHaveBeenCalledWith({
      incomeSourceId: 2,
      userId: null,
      amount: 80,
      receivedOn: null,
      note: null,
      taxWithheld: null,
    })
  })

  it('disables the submit button while submitting', () => {
    const { getByText } = render(IncomeEntryForm, { sources, submitting: true, onSubmit: vi.fn() })
    expect(getByText('Logging…').closest('button')).toBeDisabled()
  })

  it('disables the submit button when there are no sources and unattributed is not allowed', () => {
    const { getByText } = render(IncomeEntryForm, {
      sources: [],
      submitting: false,
      onSubmit: vi.fn(),
    })
    expect(getByText('Log income').closest('button')).toBeDisabled()
  })
})
