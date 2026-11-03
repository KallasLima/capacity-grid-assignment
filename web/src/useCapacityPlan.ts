import { useCallback, useEffect, useRef, useState } from 'react'
import { capacityInput, type CanonicalPerson, type Person } from './capacity'

export type CapacityDraft = {
  id: number
  name: string
  expectedWeeklyHours: number
  weeklyHours: number
  allocatedHours: number[]
}

type Options = { onApplied: () => void; onReconcile: () => void }
const isPerson = (value: unknown): value is CanonicalPerson =>
  !!value &&
  typeof value === 'object' &&
  'id' in value &&
  typeof value.id === 'number' &&
  'name' in value &&
  typeof value.name === 'string' &&
  'weeklyHours' in value &&
  typeof value.weeklyHours === 'number' &&
  Number.isFinite(value.weeklyHours)

export function useCapacityPlan(options: Options) {
  const [active, setActive] = useState(false)
  const [drafts, setDrafts] = useState<CapacityDraft[]>([])
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [reviewedConflict, setReviewedConflict] = useState(false)
  const draftsRef = useRef(drafts)
  const applyingRef = useRef(false)
  const activeRef = useRef(false)
  const uncertainRef = useRef(false)
  const callbacks = useRef(options)
  callbacks.current = options
  const controller = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const replace = useCallback((next: CapacityDraft[]) => {
    draftsRef.current = next
    setDrafts(next)
  }, [])
  const markUncertain = useCallback((value: boolean) => {
    uncertainRef.current = value
    setUncertain(value)
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      controller.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (!drafts.length) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [drafts.length])

  const start = useCallback(() => {
    if (applyingRef.current || activeRef.current) return
    activeRef.current = true
    setActive(true)
    replace([])
    setError(null)
    markUncertain(false)
    setReviewedConflict(false)
  }, [replace, markUncertain])

  const stage = useCallback(
    async (person: Person, weeklyHours: number) => {
      if (!activeRef.current || applyingRef.current || uncertainRef.current)
        throw new Error(
          'Confirm the previous apply or close and refresh before changing this plan.',
        )
      if (capacityInput(String(weeklyHours)) !== weeklyHours)
        throw new Error('Enter 0–168 hours, with up to 2 decimal places.')
      const previous = draftsRef.current.find((draft) => draft.id === person.id)
      const expected = previous?.expectedWeeklyHours ?? person.weeklyHours
      const remaining = draftsRef.current.filter(
        (draft) => draft.id !== person.id,
      )
      if (weeklyHours !== expected) {
        if (remaining.length >= 100)
          throw new Error(
            'A plan can change up to 100 people. Apply or remove a change first.',
          )
        remaining.push({
          id: person.id,
          name: person.name,
          expectedWeeklyHours: expected,
          weeklyHours,
          allocatedHours: [...person.allocatedHours],
        })
      }
      replace(remaining)
      setError(null)
    },
    [replace],
  )

  const remove = useCallback(
    (id: number) => {
      if (applyingRef.current || uncertainRef.current) return
      replace(draftsRef.current.filter((draft) => draft.id !== id))
    },
    [replace],
  )

  const project = useCallback(
    (person: Person): Person => {
      const draft = drafts.find((change) => change.id === person.id)
      return draft ? { ...person, weeklyHours: draft.weeklyHours } : person
    },
    [drafts],
  )

  const discard = useCallback(() => {
    if (applyingRef.current) return
    activeRef.current = false
    setActive(false)
    replace([])
    setError(null)
    markUncertain(false)
    setReviewedConflict(false)
    // Refresh even an untouched plan: another manager may have edited its baseline.
    callbacks.current.onReconcile()
  }, [replace, markUncertain])

  const apply = useCallback(async () => {
    if (applyingRef.current || !activeRef.current || !draftsRef.current.length)
      return
    applyingRef.current = true
    setApplying(true)
    setError(null)
    const abort = new AbortController()
    controller.current = abort
    const timeout = window.setTimeout(() => abort.abort(), 15_000)
    const changes = draftsRef.current.map(
      ({ id, weeklyHours, expectedWeeklyHours }) => ({
        id,
        weeklyHours,
        expectedWeeklyHours,
      }),
    )
    try {
      const response = await fetch('/api/people/capacities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
        signal: abort.signal,
      })
      const body: unknown = await response.json()
      if (!mounted.current) return
      if (
        response.status === 409 &&
        body &&
        typeof body === 'object' &&
        'people' in body &&
        Array.isArray(body.people) &&
        body.people.every(isPerson)
      ) {
        const current = new Map(
          body.people.map((person) => [person.id, person]),
        )
        replace(
          draftsRef.current.flatMap((draft) => {
            const person = current.get(draft.id)
            if (!person) return [draft]
            return person.weeklyHours === draft.weeklyHours
              ? []
              : [{ ...draft, expectedWeeklyHours: person.weeklyHours }]
          }),
        )
        setReviewedConflict(true)
        markUncertain(false)
        setError(
          'Some capacities changed elsewhere. This attempt applied no changes. Your draft is kept with the latest starting values; review it before applying again.',
        )
        callbacks.current.onReconcile()
        return
      }
      if (!response.ok) {
        markUncertain(response.status >= 500)
        const message =
          body &&
          typeof body === 'object' &&
          'error' in body &&
          typeof body.error === 'string'
            ? body.error
            : 'The plan could not be applied. Please try again.'
        setError(message)
        return
      }
      activeRef.current = false
      setActive(false)
      replace([])
      markUncertain(false)
      setReviewedConflict(false)
      callbacks.current.onApplied()
    } catch {
      if (!mounted.current) return
      markUncertain(true)
      setError(
        'Apply was not confirmed. Your draft is kept. Retry safely, or close the plan and refresh current values.',
      )
    } finally {
      window.clearTimeout(timeout)
      applyingRef.current = false
      if (mounted.current) setApplying(false)
    }
  }, [replace, markUncertain])

  return {
    active,
    start,
    discard,
    drafts,
    project,
    stage,
    apply,
    applying,
    error,
    uncertain,
    reviewedConflict,
    remove,
  }
}

export type CapacityPlan = ReturnType<typeof useCapacityPlan>
