import React from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CapacityGrid } from './CapacityGrid'
import type { Capacity } from './capacity'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function capacity(name = 'Ana Ferreira', weeklyHours = 40): Capacity {
  return {
    from: '2025-12-29',
    to: '2026-01-18',
    offset: 0,
    limit: 50,
    total: 1,
    weeks: [
      { start: '2025-12-29', end: '2026-01-04' },
      { start: '2026-01-05', end: '2026-01-11' },
      { start: '2026-01-12', end: '2026-01-18' },
    ],
    people: [{ id: 1, name, weeklyHours, allocatedHours: [45, 30, 0] }],
  }
}

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('CapacityGrid', () => {
  it('retains a failed save draft, then updates every visible week and overload count on retry', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(capacity()))
      .mockResolvedValueOnce(
        json({ error: 'Temporary save failure. Please retry.' }, 503),
      )
      .mockResolvedValueOnce(
        json({ id: 1, name: 'Ana Ferreira', weeklyHours: 50 }),
      )
    vi.stubGlobal('fetch', fetchMock)
    render(<CapacityGrid from="2025-12-29" to="2026-01-16" />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Edit weekly capacity for Ana Ferreira',
      }),
    )
    const input = screen.getByRole('spinbutton', {
      name: 'Weekly hours for Ana Ferreira',
    }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Temporary save failure. Please retry.',
    )
    expect(input.value).toBe('50')
    expect(
      screen.getAllByRole('cell', {
        name: /Ana Ferreira, week of .*40 hours capacity/,
      }),
    ).toHaveLength(3)
    expect(screen.getByText('5 h over capacity')).toBeTruthy()
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'PATCH',
      body: '{"weeklyHours":50}',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved')
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(
      screen.getAllByRole('cell', {
        name: /Ana Ferreira, week of .*50 hours capacity/,
      }),
    ).toHaveLength(3)
    expect(screen.queryByText('5 h over capacity')).toBeNull()
    expect(screen.getByText('5 h available')).toBeTruthy()
    expect(screen.getByText('20 h available')).toBeTruthy()
    expect(
      screen.getByText(/people over capacity on this page/).textContent,
    ).toBe('0 people over capacity on this page')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it.each(['Cancel', 'Escape'] as const)(
    'reconciles an uncertain save on %s and restores focus after the delayed server response',
    async (dismiss) => {
      // The server may have committed the PATCH even though its response was lost.
      const reconciliation = deferred<Response>()
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json(capacity()))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockReturnValueOnce(reconciliation.promise)
      vi.stubGlobal('fetch', fetchMock)
      render(<CapacityGrid from="2025-12-29" to="2026-01-16" />)

      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Edit weekly capacity for Ana Ferreira',
        }),
      )
      const input = screen.getByRole('spinbutton', {
        name: 'Weekly hours for Ana Ferreira',
      }) as HTMLInputElement
      fireEvent.change(input, { target: { value: '50' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect((await screen.findByRole('alert')).textContent).toMatch(
        /Save was not confirmed.*draft is kept/,
      )
      expect(input.value).toBe('50')

      if (dismiss === 'Cancel')
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      else fireEvent.keyDown(input, { key: 'Escape' })
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
      expect(String(fetchMock.mock.calls[2][0])).toContain('/api/capacity?')
      expect(screen.getByText('Loading capacity…')).toBeTruthy()

      // Resolve only after the old editor has unmounted: focus must survive a real refetch.
      await act(async () => {
        reconciliation.resolve(json(capacity('Ana Ferreira', 50)))
      })
      const editButton = await screen.findByRole('button', {
        name: 'Edit weekly capacity for Ana Ferreira',
      })
      expect(
        screen.getAllByRole('cell', {
          name: /Ana Ferreira, week of .*50 hours capacity/,
        }),
      ).toHaveLength(3)
      await waitFor(() => expect(document.activeElement).toBe(editButton))
      expect(fetchMock).toHaveBeenCalledTimes(3)
    },
  )

  it('keeps the newly selected range when an aborted older request arrives late', async () => {
    // Ignore AbortSignal in the mock so this checks response ordering as well as cancellation.
    const oldRequest = deferred<Response>()
    const currentRequest = deferred<Response>()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise)
    vi.stubGlobal('fetch', fetchMock)
    render(<CapacityGrid from="2025-12-29" to="2026-01-16" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      'from=2026-01-05&to=2026-01-23',
    )
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)

    const latest = capacity('Latest range person')
    latest.from = '2026-01-05'
    latest.to = '2026-01-25'
    latest.weeks = [
      { start: '2026-01-05', end: '2026-01-11' },
      { start: '2026-01-12', end: '2026-01-18' },
      { start: '2026-01-19', end: '2026-01-25' },
    ]
    await act(async () => {
      currentRequest.resolve(json(latest))
    })
    await screen.findByText('Latest range person')

    await act(async () => {
      oldRequest.resolve(json(capacity('Obsolete range person')))
    })
    expect(screen.queryByText('Obsolete range person')).toBeNull()
    expect(screen.getByText('Latest range person')).toBeTruthy()
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe(
      '2026-01-05',
    )
  })
})
