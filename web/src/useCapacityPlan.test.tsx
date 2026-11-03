import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Person } from './capacity'
import { useCapacityPlan } from './useCapacityPlan'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ana: Person = {
  id: 1,
  name: 'Ana Ferreira',
  weeklyHours: 40,
  allocatedHours: [45, 30],
}
const bo: Person = {
  id: 2,
  name: 'Bo Lindqvist',
  weeklyHours: 20,
  allocatedHours: [12, 24],
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

function setup(fetchMock = vi.fn<typeof fetch>()) {
  vi.stubGlobal('fetch', fetchMock)
  const onApplied = vi.fn()
  const onReconcile = vi.fn()
  const hook = renderHook(() => useCapacityPlan({ onApplied, onReconcile }))
  act(() => hook.result.current.start())
  return { ...hook, fetchMock, onApplied, onReconcile }
}

describe('capacity plan staging and atomic application', () => {
  it('previews multiple people without writing and retains each original expected capacity on restaging', async () => {
    const { result, fetchMock, onApplied } = setup(
      vi.fn<typeof fetch>().mockResolvedValue(
        json({
          people: [
            { id: 1, name: ana.name, weeklyHours: 55 },
            { id: 2, name: bo.name, weeklyHours: 24 },
          ],
        }),
      ),
    )
    await act(async () => {
      await result.current.stage(ana, 50)
    })
    await act(async () => {
      await result.current.stage(result.current.project(ana), 55)
    })
    await act(async () => {
      await result.current.stage(bo, 24)
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.project(ana).weeklyHours).toBe(55)
    expect(result.current.project(bo).weeklyHours).toBe(24)
    expect(ana.weeklyHours).toBe(40)
    expect(result.current.project(ana).allocatedHours).toEqual([45, 30])

    await act(async () => {
      await result.current.apply()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/people/capacities')
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PATCH')
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(payload.changes).toHaveLength(2)
    expect(payload.changes).toEqual(
      expect.arrayContaining([
        { id: 1, weeklyHours: 55, expectedWeeklyHours: 40 },
        { id: 2, weeklyHours: 24, expectedWeeklyHours: 20 },
      ]),
    )
    expect(onApplied).toHaveBeenCalledTimes(1)
    expect(result.current.active).toBe(false)
  })

  it('removes a no-op restage instead of including an unchanged person in the batch', async () => {
    const { result, fetchMock } = setup(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          json({ people: [{ id: 2, name: bo.name, weeklyHours: 30 }] }),
        ),
    )
    await act(async () => {
      await result.current.stage(ana, 50)
    })
    await act(async () => {
      await result.current.stage(result.current.project(ana), 40)
    })
    await act(async () => {
      await result.current.stage(bo, 30)
    })
    expect(result.current.project(ana).weeklyHours).toBe(40)
    await act(async () => {
      await result.current.apply()
    })
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      changes: [{ id: 2, weeklyHours: 30, expectedWeeklyHours: 20 }],
    })
  })

  it('keeps a conflicted plan for review and uses the returned capacities only on an explicit retry', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json(
          {
            error: 'Some capacities changed since this plan was prepared.',
            people: [
              { id: 1, name: ana.name, weeklyHours: 32 },
              { id: 2, name: bo.name, weeklyHours: 24 },
            ],
          },
          409,
        ),
      )
      .mockResolvedValueOnce(
        json({
          people: [
            { id: 1, name: ana.name, weeklyHours: 50 },
            { id: 2, name: bo.name, weeklyHours: 30 },
          ],
        }),
      )
    const { result, onApplied } = setup(fetchMock)
    await act(async () => {
      await result.current.stage(ana, 50)
    })
    await act(async () => {
      await result.current.stage(bo, 30)
    })
    await act(async () => {
      await result.current.apply()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onApplied).not.toHaveBeenCalled()
    expect(result.current.active).toBe(true)
    expect(result.current.reviewedConflict).toBe(true)
    expect(result.current.error).toBeTruthy()
    expect(result.current.project(ana).weeklyHours).toBe(50)
    expect(result.current.project(bo).weeklyHours).toBe(30)

    await act(async () => {
      await result.current.apply()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(
      JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).changes,
    ).toEqual(
      expect.arrayContaining([
        { id: 1, weeklyHours: 50, expectedWeeklyHours: 32 },
        { id: 2, weeklyHours: 30, expectedWeeklyHours: 24 },
      ]),
    )
    expect(onApplied).toHaveBeenCalledTimes(1)
  })

  it('retains an uncertain plan and reconciles server state when it is discarded', async () => {
    const { result, fetchMock, onApplied, onReconcile } = setup(
      vi
        .fn<typeof fetch>()
        .mockRejectedValueOnce(new TypeError('Failed to fetch')),
    )
    await act(async () => {
      await result.current.stage(ana, 50)
    })
    await act(async () => {
      await result.current.apply()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.active).toBe(true)
    expect(result.current.uncertain).toBe(true)
    expect(result.current.project(ana).weeklyHours).toBe(50)
    expect(onApplied).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.discard()
    })
    expect(result.current.active).toBe(false)
    expect(onReconcile).toHaveBeenCalledTimes(1)
    expect(result.current.project(ana).weeklyHours).toBe(40)
  })

  it('keeps an unconfirmed batch intact until an identical retry confirms it', async () => {
    const { result, fetchMock, onApplied, onReconcile } = setup(
      vi
        .fn<typeof fetch>()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(
          json({ people: [{ id: 1, name: ana.name, weeklyHours: 50 }] }),
        ),
    )
    await act(async () => {
      await result.current.stage(ana, 50)
      await result.current.apply()
    })
    const warning = result.current.error
    expect(warning).toMatch(/Apply was not confirmed/)

    await expect(result.current.stage(bo, 30)).rejects.toThrow(
      /Confirm the previous apply/,
    )
    await expect(
      result.current.stage(result.current.project(ana), 40),
    ).rejects.toThrow(/Confirm the previous apply/)
    act(() => result.current.remove(ana.id))
    expect(result.current.uncertain).toBe(true)
    expect(result.current.error).toBe(warning)
    expect(result.current.drafts).toHaveLength(1)
    expect(result.current.project(ana).weeklyHours).toBe(50)
    expect(result.current.project(bo).weeklyHours).toBe(20)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.apply()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1]?.body).toBe(
      fetchMock.mock.calls[0][1]?.body,
    )
    expect(result.current.active).toBe(false)
    expect(result.current.uncertain).toBe(false)
    expect(onApplied).toHaveBeenCalledTimes(1)
    expect(onReconcile).not.toHaveBeenCalled()
  })
})
