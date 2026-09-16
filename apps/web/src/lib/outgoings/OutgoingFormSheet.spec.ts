import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import OutgoingFormSheet from './OutgoingFormSheet.svelte'
import type { OutgoingAdapter, OutgoingRecord } from './types'

function makeAdapter(
  overrides: Partial<OutgoingAdapter<OutgoingRecord>> = {}
): OutgoingAdapter<OutgoingRecord> {
  return {
    kind: 'things',
    title: 'Things',
    singular: 'Thing',
    emptyMessage: '',
    supportsLifecycle: true,
    hasHistory: false,
    columns: [],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'isRecurring', label: 'Recurring', type: 'checkbox' },
      { key: 'categoryId', label: 'Category', type: 'category' },
      {
        key: 'frequency',
        label: 'Frequency',
        type: 'select',
        options: [{ value: 'a', label: 'A' }],
      },
    ],
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setLifecycle: vi.fn(),
    remove: vi.fn(),
    trend: vi.fn(),
    href: vi.fn(),
    subtitle: vi.fn(),
    state: vi.fn(),
    rowValues: vi.fn(),
    stats: vi.fn(),
    toFormValues: vi.fn(() => ({ name: 'Existing', amount: 5, isRecurring: true })),
    ...overrides,
  } as unknown as OutgoingAdapter<OutgoingRecord>
}

const categories = [
  {
    id: 5,
    name: 'Insurance',
    color: null,
    sortOrder: 0,
    parentId: null,
    isActive: true,
    isArchived: false,
    isSystem: false,
  },
]

function renderSheet(props: Record<string, unknown> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(OutgoingFormSheet, {
    props: {
      open: true,
      onOpenChange: vi.fn(),
      adapter: makeAdapter(),
      categories,
      users: [],
      item: null,
      onSubmit,
      ...props,
    },
  })
  return { onSubmit }
}

function submitForm() {
  // The form is portalled into the drawer/sheet content on `document.body`,
  // not the render container.
  return fireEvent.submit(document.querySelector('#outgoing-form')!)
}

describe('OutgoingFormSheet', () => {
  it('renders the add title and blocks a blank required text field', async () => {
    const { onSubmit } = renderSheet()

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: '' } })
    await fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '10' } })
    await submitForm()

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText('Enter a name')).toBeInTheDocument()
  })

  it('treats a blank required number as missing, not as zero', async () => {
    const { onSubmit } = renderSheet()

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Thing' } })
    await submitForm()

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText('Enter an amount')).toBeInTheDocument()
  })

  it('submits the collected values', async () => {
    const { onSubmit } = renderSheet()

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Thing' } })
    await fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '12.5' } })
    await fireEvent.click(screen.getByLabelText('Recurring'))
    await submitForm()

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Thing', amount: '12.5', isRecurring: true })
    )
  })

  it('prefills from the item and switches to the edit title', async () => {
    const { onSubmit } = renderSheet({ item: { id: 1, name: 'Existing', isActive: true } })

    expect(screen.getByDisplayValue('Existing')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()

    await submitForm()
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Existing', amount: 5 }))
  })

  it('uses editFields when editing', () => {
    renderSheet({
      item: { id: 1, name: 'Existing', isActive: true },
      adapter: makeAdapter({
        editFields: [{ key: 'frequency', label: 'Billing frequency', type: 'select', options: [] }],
      }),
    })

    expect(screen.getByLabelText('Billing frequency')).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('renders user, date and select field types', () => {
    renderSheet({
      adapter: makeAdapter({
        fields: [
          { key: 'userId', label: 'For', type: 'user', required: true },
          { key: 'nextDueOn', label: 'Next due', type: 'date', required: true },
          {
            key: 'frequency',
            label: 'Frequency',
            type: 'select',
            options: [{ value: 'a', label: 'A' }],
          },
        ],
      }),
      users: [
        { id: 1, fullName: 'Adam', email: 'a@test.local', displayColor: null, initials: 'A' },
      ],
    })

    expect(screen.getByLabelText('For')).toBeInTheDocument()
    expect(screen.getByLabelText('Next due')).toBeInTheDocument()
    expect(screen.getByLabelText('Frequency')).toBeInTheDocument()
  })

  it('prefills selects whose option values are numbers (user id, numeric select options)', () => {
    // Regression: Svelte compares the select's raw `value` against each
    // option's raw JS value with `Object.is`, so a stringified `value` (the
    // component's `display()`) never matched a numeric option value and the
    // select rendered empty (`selectedIndex === -1`) - and cleared again the
    // moment the user picked one.
    renderSheet({
      item: { id: 1, name: 'Existing', isActive: true },
      adapter: makeAdapter({
        fields: [
          { key: 'userId', label: 'For', type: 'user', required: true },
          {
            key: 'frequency',
            label: 'Frequency',
            type: 'select',
            options: [
              { value: 1, label: 'Monthly' },
              { value: 12, label: 'Annual' },
            ],
          },
        ],
        toFormValues: () => ({ userId: 2, frequency: 12 }),
      }),
      users: [
        { id: 1, fullName: 'Adam', email: 'a@test.local', displayColor: null, initials: 'A' },
        { id: 2, fullName: 'Bea', email: 'b@test.local', displayColor: null, initials: 'B' },
      ],
    })

    expect(screen.getByLabelText('For')).toHaveValue('2')
    expect(screen.getByLabelText('Frequency')).toHaveValue('12')
  })

  it('closes via the footer cancel button', async () => {
    const onOpenChange = vi.fn()
    renderSheet({ onOpenChange })

    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('surfaces an error thrown by onSubmit', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Nope'))
    renderSheet({ onSubmit })

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Thing' } })
    await fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '1' } })
    await submitForm()

    expect(await screen.findByText('Nope')).toBeInTheDocument()
  })
})
