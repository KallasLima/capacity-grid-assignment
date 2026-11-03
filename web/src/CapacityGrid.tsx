import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { dateLabel, hours, shiftDate, type Query } from './capacity'
import { useCapacity } from './useCapacity'
import { CapacityEditor } from './CapacityEditor'
import { AllocationCell } from './AllocationCell'

type Props = { from: string; to: string }

export function CapacityGrid({ from, to }: Props) {
  const [query, setQuery] = useState<Query>({ from, to, offset: 0 })
  const [range, setRange] = useState({ from, to })
  const [rangeError, setRangeError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const { data, loading, error, savingId, savePerson, reload } =
    useCapacity(query)
  const gridPanel = useRef<HTMLDivElement>(null)
  const retryButton = useRef<HTMLButtonElement>(null)
  const focusAfterReload = useRef<number | null>(null)
  useEffect(() => {
    if (focusAfterReload.current === null || loading) return
    if (error) {
      retryButton.current?.focus()
      return
    }
    const button = gridPanel.current?.querySelector<HTMLButtonElement>(
      `button[data-person-id="${focusAfterReload.current}"]`,
    )
    if (button) {
      button.focus()
      focusAfterReload.current = null
    }
  }, [data, loading, error])
  function reconcile(id: number) {
    focusAfterReload.current = id
    reload()
  }
  const busy = savingId !== null
  const viewLocked = busy || editingId !== null
  const overCount =
    data?.people.filter((person) =>
      person.allocatedHours.some((value) => value > person.weeklyHours),
    ).length ?? 0
  function applyRange(event: FormEvent) {
    event.preventDefault()
    if (!range.from || !range.to || range.from > range.to) {
      setRangeError('Choose an end date on or after the start date.')
      return
    }
    const days = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000
    if (days > 735) {
      setRangeError('Choose a range of up to 2 years.')
      return
    }
    setRangeError('')
    setQuery({ ...range, offset: 0 })
  }
  function navigate(days: number) {
    const next = {
      from: shiftDate(query.from, days),
      to: shiftDate(query.to, days),
    }
    setRange(next)
    setRangeError('')
    setQuery({ ...next, offset: 0 })
  }
  return (
    <section aria-label="Team capacity planning">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">TEAM PLANNING</p>
          <h1>
            Team capacity<span className="title-dot">.</span>
          </h1>
          <p className="intro">
            See who has room, and who has too much on their plate.
          </p>
        </div>
        <div className="legend">
          <span>
            <i className="legend-dot available" />
            Within capacity
          </span>
          <span>
            <i className="legend-dot overload" />
            Over capacity
          </span>
        </div>
      </div>
      <div className="toolbar">
        <div className="week-navigation" aria-label="Week navigation">
          <button
            className="icon-button"
            disabled={viewLocked}
            onClick={() => navigate(-7)}
            aria-label="Previous week"
          >
            ←
          </button>
          <button
            className="icon-button"
            disabled={viewLocked}
            onClick={() => navigate(7)}
            aria-label="Next week"
          >
            →
          </button>
          <span>
            {viewLocked
              ? 'Save or cancel your edit to change the view'
              : 'Move by week'}
          </span>
        </div>
        <form className="range-form" onSubmit={applyRange}>
          <label>
            From
            <input
              type="date"
              value={range.from}
              disabled={viewLocked}
              required
              onChange={(event) =>
                setRange((current) => ({
                  ...current,
                  from: event.target.value,
                }))
              }
            />
          </label>
          <span className="range-dash" aria-hidden="true">
            –
          </span>
          <label>
            To
            <input
              type="date"
              value={range.to}
              disabled={viewLocked}
              required
              onChange={(event) =>
                setRange((current) => ({ ...current, to: event.target.value }))
              }
            />
          </label>
          <button
            className="primary-button"
            disabled={viewLocked}
            type="submit"
          >
            Apply range
          </button>
        </form>
      </div>
      {rangeError && (
        <p role="alert" className="range-error">
          {rangeError}
        </p>
      )}
      <div className="grid-context">
        <span>
          {data
            ? `${dateLabel(data.from)} – ${dateLabel(data.to, { month: 'short', day: 'numeric', year: 'numeric' })}`
            : 'Weekly allocation'}
        </span>
        <span>
          {data
            ? `${data.weeks.length} ${data.weeks.length === 1 ? 'week' : 'weeks'} · ${data.total} people`
            : loading
              ? 'Loading your team…'
              : 'Capacity unavailable'}
        </span>
      </div>
      <p className="scroll-cue">Swipe across the grid to see each week.</p>
      <div ref={gridPanel} className="grid-panel" aria-busy={loading}>
        {loading ? (
          <div className="grid-loading" role="status">
            <span className="loading-dot" />
            Loading capacity…
            <div className="skeleton-lines" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="grid-error" role="alert">
            <span className="state-icon">!</span>
            <h2>Capacity couldn’t be loaded</h2>
            <p>{error}</p>
            <button
              ref={retryButton}
              className="primary-button"
              onClick={reload}
            >
              Try again
            </button>
          </div>
        ) : data && data.people.length > 0 ? (
          <div
            className="table-scroll"
            tabIndex={0}
            aria-label="Scrollable capacity grid"
          >
            <table
              style={{ '--week-count': data.weeks.length } as CSSProperties}
            >
              <caption className="sr-only">
                Allocated hours against recurring weekly capacity. Weeks start
                on Monday; allocations count weekdays.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="person-column">
                    Team member
                  </th>
                  <th scope="col" className="capacity-column">
                    Weekly capacity<span>Click to edit</span>
                  </th>
                  {data.weeks.map((week) => (
                    <th scope="col" key={week.start} className="week-column">
                      <span className="week-kicker">
                        WEEK OF {dateLabel(week.start, { year: 'numeric' })}
                      </span>
                      <strong>
                        {dateLabel(week.start)} – {dateLabel(week.end)}
                      </strong>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.people.map((person) => (
                  <tr key={person.id}>
                    <th scope="row" className="person-column">
                      <span className="person-cell">
                        <span className="avatar" aria-hidden="true">
                          {person.name
                            .split(' ')
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <span title={person.name}>{person.name}</span>
                      </span>
                    </th>
                    <td className="capacity-column">
                      <CapacityEditor
                        person={person}
                        busy={
                          busy ||
                          (editingId !== null && editingId !== person.id)
                        }
                        save={savePerson}
                        onEditing={setEditingId}
                        onReconcile={reconcile}
                      />
                    </td>
                    {data.weeks.map((week, index) => (
                      <td
                        key={week.start}
                        aria-label={`${person.name}, week of ${week.start}: ${hours(person.allocatedHours[index])} hours allocated, ${hours(person.weeklyHours)} hours capacity`}
                      >
                        <AllocationCell
                          allocated={person.allocatedHours[index]}
                          capacity={person.weeklyHours}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid-error">
            <h2>No people to show</h2>
            <p>The roster is empty for this page.</p>
            <button
              className="primary-button"
              onClick={() => setQuery((current) => ({ ...current, offset: 0 }))}
            >
              Back to first page
            </button>
          </div>
        )}
      </div>
      <div className="grid-footer">
        <p>
          {data ? (
            <>
              <strong>{overCount}</strong>{' '}
              {overCount === 1 ? 'person' : 'people'} over capacity on this page
            </>
          ) : (
            'Allocation is measured in hours, Monday to Friday.'
          )}
        </p>
        <div className="pagination">
          <span>
            {data
              ? `${query.offset + (data.people.length ? 1 : 0)}–${query.offset + data.people.length} of ${data.total}`
              : '—'}
          </span>
          <button
            className="icon-button"
            aria-label="Previous people"
            disabled={viewLocked || loading || query.offset === 0}
            onClick={() =>
              setQuery((current) => ({
                ...current,
                offset: Math.max(0, current.offset - 50),
              }))
            }
          >
            ←
          </button>
          <button
            className="icon-button"
            aria-label="Next people"
            disabled={
              viewLocked ||
              loading ||
              !data ||
              query.offset + data.people.length >= data.total
            }
            onClick={() =>
              setQuery((current) => ({
                ...current,
                offset: current.offset + 50,
              }))
            }
          >
            →
          </button>
        </div>
      </div>
      <p className="scope-note">
        Capacity is a person’s recurring weekly limit. Changing it updates every
        week.
      </p>
    </section>
  )
}
