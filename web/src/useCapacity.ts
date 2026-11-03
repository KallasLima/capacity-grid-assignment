import { useCallback, useEffect, useRef, useState } from 'react'
import {
  readResponse,
  type Capacity,
  type Person,
  type Query,
} from './capacity'

type Snapshot = {
  key: string
  data: Capacity | null
  loading: boolean
  error: string | null
}

export function useCapacity(query: Query) {
  const key = `${query.from}/${query.to}/${query.offset}`
  const [revision, setRevision] = useState(0)
  const [snapshot, setSnapshot] = useState<Snapshot>({
    key: '',
    data: null,
    loading: true,
    error: null,
  })
  const [savingId, setSavingId] = useState<number | null>(null)
  const request = useRef(0)
  const mutationVersion = useRef(0)
  const savedHours = useRef(
    new Map<number, { hours: number; version: number }>(),
  )

  useEffect(() => {
    const sequence = ++request.current
    const versionAtStart = mutationVersion.current
    const controller = new AbortController()
    let disposed = false
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    setSnapshot({ key, data: null, loading: true, error: null })
    const params = new URLSearchParams({
      from: query.from,
      to: query.to,
      offset: String(query.offset),
      limit: '50',
    })
    fetch(`/api/capacity?${params}`, { signal: controller.signal })
      .then(readResponse<Capacity>)
      .then((data) => {
        if (disposed || sequence !== request.current) return
        // Only reconcile edits confirmed after this request began. Later requests
        // remain authoritative, including changes made by another manager.
        const people = data.people.map((person) => {
          const saved = savedHours.current.get(person.id)
          return saved && saved.version > versionAtStart
            ? { ...person, weeklyHours: saved.hours }
            : person
        })
        setSnapshot({
          key,
          data: { ...data, people },
          loading: false,
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (disposed || sequence !== request.current) return
        const message = controller.signal.aborted
          ? 'The request took too long. Please try again.'
          : error instanceof Error
            ? error.message
            : 'Could not load capacity.'
        setSnapshot({ key, data: null, loading: false, error: message })
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      disposed = true
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [key, query.from, query.to, query.offset, revision])

  const savePerson = useCallback(async (id: number, weeklyHours: number) => {
    setSavingId(id)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    try {
      const person = await fetch(`/api/people/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyHours }),
        signal: controller.signal,
      }).then(readResponse<Pick<Person, 'id' | 'name' | 'weeklyHours'>>)
      savedHours.current.set(person.id, {
        hours: person.weeklyHours,
        version: ++mutationVersion.current,
      })
      setSnapshot((current) =>
        current.data
          ? {
              ...current,
              data: {
                ...current.data,
                people: current.data.people.map((row) =>
                  row.id === person.id
                    ? {
                        ...row,
                        name: person.name,
                        weeklyHours: person.weeklyHours,
                      }
                    : row,
                ),
              },
            }
          : current,
      )
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error(
          'Save timed out. Your draft is kept; retry, or cancel to reload current capacity.',
        )
      if (error instanceof TypeError)
        throw new Error(
          'Save was not confirmed. Your draft is kept; retry, or cancel to reload current capacity.',
        )
      throw error
    } finally {
      window.clearTimeout(timeout)
      setSavingId(null)
    }
  }, [])

  const reload = useCallback(() => {
    // Clear stale values synchronously, including after an uncertain write.
    setSnapshot((current) => ({
      ...current,
      data: null,
      loading: true,
      error: null,
    }))
    setRevision((value) => value + 1)
  }, [])

  return {
    data: snapshot.key === key ? snapshot.data : null,
    loading: snapshot.key !== key || snapshot.loading,
    error: snapshot.key === key ? snapshot.error : null,
    savingId,
    savePerson,
    reload,
  }
}
