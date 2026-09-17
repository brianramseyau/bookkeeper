import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { goto } from '$app/navigation'
import { toast } from 'svelte-sonner'
import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
import { lifecycleState } from '$lib/lifecycle'
import OutgoingDetail from './OutgoingDetail.svelte'
import type { OutgoingAdapter, OutgoingRecord } from './types'

vi.mock('$app/navigation', () => ({ goto: vi.fn() }))
vi.mock('$lib/api/categories', () => ({ listCategories: vi.fn().mockResolvedValue([]) }))
vi.mock('$lib/api/users', () => ({ listUsers: vi.fn().mockResolvedValue([]) }))
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn() } }))
vi.mock('$lib/components/app/confirmDestructive.svelte', () => ({
  confirmDestructive: vi.fn(),
}))

const item: OutgoingRecord = {
  id: 1,
  name: 'Car',
  isActive: true,
  isPaused: false,
  isArchived: false,
}

const trend = {
  average: 20,
  latestAmount: 25,
  latestYear: 2026,
  latestMonth: 3,
  trend: 'up' as const,
  months: [
    { year: 2026, month: 2, amount: 10 },
    { year: 2026, month: 3, amount: 25 },
  ],
}

function makeAdapter(overrides: Partial<OutgoingAdapter<OutgoingRecord>> = {}) {
  return {
    kind: 'things',
    title: 'Things',
    singular: 'Thing',
    emptyMessage: '',
    supportsLifecycle: true,
    hasHistory: true,
    columns: [],
    fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
    list: vi.fn(),
    get: vi.fn().mockResolvedValue(item),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(item),
    setLifecycle: vi.fn().mockResolvedValue(item),
    remove: vi.fn().mockResolvedValue(undefined),
    trend: vi.fn().mockResolvedValue(trend),
    history: vi.fn().mockResolvedValue([
      { id: 11, year: 2026, month: 3, paid: true, amount: 25 },
      { id: 12, year: 2026, month: 2, paid: false, amount: null },
    ]),
    deleteHistory: vi.fn().mockResolvedValue(undefined),
    href: (record: OutgoingRecord) => `/things/${record.id}`,
    subtitle: () => '',
    state: (record: OutgoingRecord) => lifecycleState(record),
    rowValues: () => ({}),
    stats: () => [{ label: 'Latest', value: '$25.00' }],
    toFormValues: (record: OutgoingRecord) => ({ name: record.name }),
    ...overrides,
  } as unknown as OutgoingAdapter<OutgoingRecord>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OutgoingDetail', () => {
  it('renders the header, stats, chart and payment history', async () => {
    render(OutgoingDetail, { props: { adapter: makeAdapter(), id: 1 } })

    expect(await screen.findByRole('heading', { name: 'Car' })).toBeInTheDocument()
    expect(screen.getByText('Latest')).toBeInTheDocument()
    expect(screen.getByText('Mar 2026')).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
    expect(screen.getByText('Unpaid')).toBeInTheDocument()
  })

  it('shows a not-found message when the item cannot be loaded', async () => {
    render(OutgoingDetail, {
      props: {
        adapter: makeAdapter({ get: vi.fn().mockRejectedValue(new Error('missing')) }),
        id: 9,
      },
    })

    expect(await screen.findByText('Failed to load')).toBeInTheDocument()
  })

  it('edits the item through the form sheet', async () => {
    const adapter = makeAdapter()
    const user = userEvent.setup()
    render(OutgoingDetail, { props: { adapter, id: 1 } })
    await screen.findByRole('heading', { name: 'Car' })

    await user.click(screen.getByRole('button', { name: 'Actions for Car' }))
    await user.click(screen.getByText('Edit'))
    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'New car' } })
    await fireEvent.submit(document.querySelector('#outgoing-form')!)

    await waitFor(() =>
      expect(adapter.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: 'New car' }),
        item
      )
    )
  })

  it('runs a lifecycle action and refreshes', async () => {
    const adapter = makeAdapter()
    const user = userEvent.setup()
    render(OutgoingDetail, { props: { adapter, id: 1 } })
    await screen.findByRole('heading', { name: 'Car' })

    await user.click(screen.getAllByRole('button', { name: 'Actions for Car' })[0]!)
    await user.click(screen.getByText('Pause'))

    await waitFor(() => expect(adapter.setLifecycle).toHaveBeenCalledWith(1, { isPaused: true }))
    expect(toast.success).toHaveBeenCalled()
  })

  it('deletes an archived item and returns to the list', async () => {
    vi.mocked(confirmDestructive).mockResolvedValue(true)
    const archived = { ...item, isArchived: true }
    const adapter = makeAdapter({ get: vi.fn().mockResolvedValue(archived) })
    const user = userEvent.setup()
    render(OutgoingDetail, { props: { adapter, id: 1 } })
    await screen.findByRole('heading', { name: 'Car' })

    await user.click(screen.getAllByRole('button', { name: 'Actions for Car' })[0]!)
    await user.click(screen.getByText('Delete'))

    await waitFor(() => expect(adapter.remove).toHaveBeenCalledWith(1))
    expect(goto).toHaveBeenCalledWith('/things')
  })

  it('deletes a payment history row after confirmation', async () => {
    vi.mocked(confirmDestructive).mockResolvedValue(true)
    const adapter = makeAdapter()
    const user = userEvent.setup()
    render(OutgoingDetail, { props: { adapter, id: 1 } })
    await screen.findByText('Mar 2026')

    await user.click(screen.getByRole('button', { name: 'Actions for Mar 2026' }))
    await user.click(screen.getByText('Delete'))

    await waitFor(() => expect(adapter.deleteHistory).toHaveBeenCalledWith(11))
  })

  it('shows a standalone Edit button instead of an actions menu when the adapter has no lifecycle', async () => {
    const adapter = makeAdapter({ supportsLifecycle: false })
    const user = userEvent.setup()
    render(OutgoingDetail, { props: { adapter, id: 1 } })
    await screen.findByRole('heading', { name: 'Car' })

    expect(screen.queryByRole('button', { name: 'Actions for Car' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'New car' } })
    await fireEvent.submit(document.querySelector('#outgoing-form')!)

    await waitFor(() =>
      expect(adapter.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: 'New car' }),
        item
      )
    )
  })

  it('renders a page-specific extra section', async () => {
    const { createRawSnippet } = await import('svelte')
    const extra = createRawSnippet(() => ({ render: () => '<p>Extra section</p>' }))
    render(OutgoingDetail, { props: { adapter: makeAdapter(), id: 1, extra } })

    expect(await screen.findByText('Extra section')).toBeInTheDocument()
  })
})
