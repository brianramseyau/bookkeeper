import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'svelte-sonner'
import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
import { lifecycleState } from '$lib/lifecycle'
import OutgoingsList from './OutgoingsList.svelte'
import type { OutgoingAdapter, OutgoingRecord } from './types'

vi.mock('$lib/api/categories', () => ({ listCategories: vi.fn() }))
vi.mock('$lib/api/users', () => ({ listUsers: vi.fn() }))
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn() } }))
vi.mock('$lib/components/app/confirmDestructive.svelte', () => ({
  confirmDestructive: vi.fn(),
}))

import { listCategories } from '$lib/api/categories'
import { listUsers } from '$lib/api/users'

interface Thing extends OutgoingRecord {
  amount: number
  frequency: 'monthly' | 'annual'
}

function makeAdapter(overrides: Partial<OutgoingAdapter<Thing>> = {}): OutgoingAdapter<Thing> {
  return {
    kind: 'things',
    title: 'Things',
    singular: 'Thing',
    emptyMessage: 'No things yet.',
    supportsLifecycle: true,
    supportsGrouping: false,
    supportsReorder: false,
    hasHistory: false,
    columns: [{ key: 'amount', label: 'Amount', align: 'right', money: true }],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
    ],
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    setLifecycle: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
    trend: vi.fn(),
    href: (item: Thing) => `/things/${item.id}`,
    subtitle: () => 'Monthly',
    state: (item: Thing) => lifecycleState(item),
    anchorId: (item: Thing) => `thing-${item.id}`,
    rowValues: (item: Thing) => ({ amount: `$${item.amount}` }),
    stats: () => [],
    toFormValues: (item: Thing) => ({ name: item.name, amount: item.amount }),
    ...overrides,
  } as unknown as OutgoingAdapter<Thing>
}

const active: Thing = {
  id: 1,
  name: 'Car',
  amount: 10,
  frequency: 'annual',
  isActive: true,
  isPaused: false,
  isArchived: false,
}
const paused: Thing = {
  id: 2,
  name: 'Gym',
  amount: 5,
  frequency: 'monthly',
  isActive: true,
  isPaused: true,
  isArchived: false,
}
const archived: Thing = {
  id: 3,
  name: 'Old',
  amount: 1,
  frequency: 'monthly',
  isActive: true,
  isArchived: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCategories).mockResolvedValue([])
  vi.mocked(listUsers).mockResolvedValue([])
  window.location.hash = ''
})

describe('OutgoingsList', () => {
  it('lists active items with lifecycle tab counts', async () => {
    const adapter = makeAdapter({ list: vi.fn().mockResolvedValue([active, paused, archived]) })
    render(OutgoingsList, { props: { adapter } })

    expect(await screen.findByRole('link', { name: 'Car' })).toHaveAttribute('href', '/things/1')
    expect(screen.getByRole('tab', { name: /Active/ })).toHaveTextContent('1')
    expect(screen.getByRole('tab', { name: /Paused/ })).toHaveTextContent('1')
    expect(screen.getByRole('tab', { name: /Archived/ })).toHaveTextContent('1')
    expect(screen.queryByRole('link', { name: 'Gym' })).not.toBeInTheDocument()
  })

  it('switches to another lifecycle tab', async () => {
    const adapter = makeAdapter({ list: vi.fn().mockResolvedValue([active, paused]) })
    render(OutgoingsList, { props: { adapter } })
    await screen.findByRole('link', { name: 'Car' })

    await userEvent.setup().click(screen.getByRole('tab', { name: /Paused/ }))

    expect(screen.getByRole('link', { name: 'Gym' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Car' })).not.toBeInTheDocument()
  })

  it('adds an item through the form sheet', async () => {
    const adapter = makeAdapter({ list: vi.fn().mockResolvedValue([]) })
    render(OutgoingsList, { props: { adapter } })

    const addButtons = await screen.findAllByRole('button', { name: 'Add thing' })
    await userEvent.setup().click(addButtons[0]!)
    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Water' } })
    await fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '30' } })
    await fireEvent.submit(document.querySelector('#outgoing-form')!)

    await waitFor(() =>
      expect(adapter.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Water', amount: '30' })
      )
    )
    expect(toast.success).toHaveBeenCalled()
  })

  it('pauses an item from its action menu', async () => {
    const adapter = makeAdapter({ list: vi.fn().mockResolvedValue([active]) })
    const user = userEvent.setup()
    render(OutgoingsList, { props: { adapter } })

    await user.click((await screen.findAllByRole('button', { name: 'Actions for Car' }))[0]!)
    await user.click(screen.getByText('Pause'))

    await waitFor(() => expect(adapter.setLifecycle).toHaveBeenCalledWith(1, { isPaused: true }))
  })

  it('deletes an archived item after confirmation', async () => {
    vi.mocked(confirmDestructive).mockResolvedValue(true)
    const adapter = makeAdapter({ list: vi.fn().mockResolvedValue([archived]) })
    const user = userEvent.setup()
    render(OutgoingsList, { props: { adapter } })

    await user.click(await screen.findByRole('tab', { name: /Archived/ }))
    await user.click(screen.getAllByRole('button', { name: 'Actions for Old' })[0]!)
    await user.click(screen.getByText('Delete'))

    await waitFor(() => expect(adapter.remove).toHaveBeenCalledWith(3))
  })

  it('does not delete when the confirmation is dismissed', async () => {
    vi.mocked(confirmDestructive).mockResolvedValue(false)
    const adapter = makeAdapter({ list: vi.fn().mockResolvedValue([archived]) })
    const user = userEvent.setup()
    render(OutgoingsList, { props: { adapter } })

    await user.click(await screen.findByRole('tab', { name: /Archived/ }))
    await user.click(screen.getAllByRole('button', { name: 'Actions for Old' })[0]!)
    await user.click(screen.getByText('Delete'))

    expect(adapter.remove).not.toHaveBeenCalled()
  })

  it('shows an empty state when there are no items', async () => {
    const adapter = makeAdapter({ list: vi.fn().mockResolvedValue([]) })
    render(OutgoingsList, { props: { adapter } })

    expect(await screen.findByText('No things yet.')).toBeInTheDocument()
  })

  it('scrolls to and flashes an anchored row after loading', async () => {
    const adapter = makeAdapter({ list: vi.fn().mockResolvedValue([active]) })
    window.location.hash = '#thing-1'
    render(OutgoingsList, { props: { adapter } })

    const row = await screen.findByRole('link', { name: 'Car' })
    await waitFor(() => expect(row.closest('tr')).toHaveClass('highlight-flash'))
  })

  it('groups rows and renders a header snippet', async () => {
    const { createRawSnippet } = await import('svelte')
    const header = createRawSnippet(() => ({ render: () => '<p>Switcher</p>' }))
    const adapter = makeAdapter({
      list: vi.fn().mockResolvedValue([
        { ...active, id: 1, name: 'Car', frequency: 'annual' },
        { ...active, id: 2, name: 'Gym', frequency: 'monthly' },
      ]),
      supportsGrouping: true,
      group: (item: Thing) => item.frequency,
      groupOrder: ['monthly', 'annual'],
      groupLabel: (key: string) => (key === 'annual' ? 'Yearly' : 'Monthly'),
    })
    render(OutgoingsList, { props: { adapter, header } })

    expect(await screen.findByText('Switcher')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Car' })).toBeInTheDocument()
    expect(screen.getByText('Yearly')).toBeInTheDocument()
    expect(screen.getAllByText('Monthly').length).toBeGreaterThan(0)
  })

  it('edits an item through the form sheet', async () => {
    const adapter = makeAdapter({ list: vi.fn().mockResolvedValue([active]) })
    const user = userEvent.setup()
    render(OutgoingsList, { props: { adapter } })

    await user.click((await screen.findAllByRole('button', { name: 'Actions for Car' }))[0]!)
    await user.click(screen.getByText('Edit'))
    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Renamed' } })
    await fireEvent.submit(document.querySelector('#outgoing-form')!)

    await waitFor(() =>
      expect(adapter.update).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Renamed' }), active)
    )
  })

  it('shows a load error', async () => {
    const adapter = makeAdapter({ list: vi.fn().mockRejectedValue(new Error('nope')) })
    render(OutgoingsList, { props: { adapter } })

    expect(await screen.findByText('Failed to load')).toBeInTheDocument()
  })

  it('renders adaptive actions without a lifecycle when unsupported', async () => {
    const adapter = makeAdapter({
      list: vi.fn().mockResolvedValue([active]),
      supportsLifecycle: false,
    })
    const user = userEvent.setup()
    render(OutgoingsList, { props: { adapter } })

    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    await user.click((await screen.findAllByRole('button', { name: 'Actions for Car' }))[0]!)
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.queryByText('Pause')).not.toBeInTheDocument()
  })
})
