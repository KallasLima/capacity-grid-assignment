import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import {
  dateLabel,
  dateRangeLabel,
  hours,
  shiftDate,
  type Query,
  type Person,
} from './capacity'
import { useCapacity } from './useCapacity'
import { CapacityEditor } from './CapacityEditor'
import { AllocationCell } from './AllocationCell'
import { AllocationDetails } from './AllocationDetails'

type Props = { from: string; to: string }
function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4 4" />
    </svg>
  )
}

export function CapacityGrid({ from, to }: Props) {
  const [query, setQuery] = useState<Query & { search?: string }>({
    from,
    to,
    offset: 0,
    search: '',
  })
  const [range, setRange] = useState({ from, to })
  const [search, setSearch] = useState('')
  const [rangeError, setRangeError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [mobileWeek, setMobileWeek] = useState(0)
  const [details, setDetails] = useState<{
    personId: number
    personName: string
    week: string
  } | null>(null)
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
  useEffect(() => {
    setMobileWeek(0)
  }, [query.from, query.to])
  function reconcile(id: number) {
    focusAfterReload.current = id
    reload()
  }
  function openDetails(person: Person) {
    if (!data) return
    const overloaded = person.allocatedHours.findIndex(
      (value) => value > person.weeklyHours,
    )
    const allocated = person.allocatedHours.findIndex((value) => value > 0)
    const index = window.matchMedia('(max-width: 680px)').matches
      ? mobileWeek
      : overloaded >= 0
        ? overloaded
        : Math.max(0, allocated)
    const week = data.weeks[Math.min(index, data.weeks.length - 1)].start
    setDetails({ personId: person.id, personName: person.name, week })
  }
  const busy = savingId !== null
  const viewLocked = busy || editingId !== null
  const overCount =
    data?.people.filter((person) =>
      person.allocatedHours.some((value) => value > person.weeklyHours),
    ).length ?? 0
  const allocated =
    data?.people.reduce(
      (sum, person) => sum + person.allocatedHours.reduce((a, b) => a + b, 0),
      0,
    ) ?? 0
  const available =
    data?.people.reduce(
      (sum, person) =>
        sum +
        person.allocatedHours.reduce(
          (total, value) => total + Math.max(0, person.weeklyHours - value),
          0,
        ),
      0,
    ) ?? 0
  function applyRange(event: FormEvent) {
    event.preventDefault()
    if (!range.from || !range.to || range.from > range.to) {
      setRangeError('Choose an end date on or after the start date.')
      return
    }
    if ((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000 > 735) {
      setRangeError('Choose a range of up to 2 years.')
      return
    }
    setRangeError('')
    setQuery((current) => ({ ...current, ...range, offset: 0 }))
  }
  function navigate(days: number) {
    const next = {
      from: shiftDate(query.from, days),
      to: shiftDate(query.to, days),
    }
    setRange(next)
    setRangeError('')
    setQuery((current) => ({ ...current, ...next, offset: 0 }))
  }
  function chooseWeeks(count: number) {
    const weekday = new Date(`${query.from}T12:00:00Z`).getUTCDay()
    const start = shiftDate(query.from, -((weekday + 6) % 7))
    const next = { from: start, to: shiftDate(start, count * 7 - 1) }
    setRange(next)
    setRangeError('')
    setQuery((current) => ({ ...current, ...next, offset: 0 }))
  }
  function applySearch(event: FormEvent) {
    event.preventDefault()
    setQuery((current) => ({ ...current, search: search.trim(), offset: 0 }))
  }
  function clearSearch() {
    setSearch('')
    setQuery((current) => ({ ...current, search: '', offset: 0 }))
  }
  function resetView() {
    setSearch('')
    setRange({ from, to })
    setRangeError('')
    setQuery({ from, to, offset: 0, search: '' })
  }
  const currentMobileWeek =
    data?.weeks[Math.min(mobileWeek, data.weeks.length - 1)]
  return (
    <section aria-label="Team capacity planning">
      <div className="page-breadcrumb">
        <span className="breadcrumb-mark" aria-hidden="true">
          ▦
        </span>
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <strong>Team planning</strong>
      </div>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">PEOPLE & WORKLOAD</p>
          <h1>
            Team capacity<span className="title-dot">.</span>
          </h1>
          <p className="intro">
            Compare allocation with capacity, week by week.
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
      <div className="planning-controls">
        <div className="toolbar">
          <div className="range-navigation">
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
            </div>
            <div className="date-range-title">
              {data ? dateRangeLabel(data.from, data.to) : 'Weekly allocation'}
              <span>
                {viewLocked
                  ? 'Finish your edit to change the view'
                  : 'Monday–Friday · hours per week'}
              </span>
            </div>
          </div>
          <div className="range-presets" aria-label="Date range presets">
            {[3, 6, 12].map((count) => (
              <button
                key={count}
                type="button"
                disabled={viewLocked}
                className={data?.weeks.length === count ? 'active' : ''}
                aria-pressed={data?.weeks.length === count}
                onClick={() => chooseWeeks(count)}
              >
                {count} weeks
              </button>
            ))}
          </div>
          <button
            className="text-button reset-button"
            disabled={viewLocked}
            onClick={resetView}
          >
            Reset view
          </button>
        </div>
        <div className="filter-toolbar">
          <form className="people-search" onSubmit={applySearch}>
            <SearchIcon />
            <label className="sr-only" htmlFor="people-search">
              Search people
            </label>
            <input
              id="people-search"
              type="search"
              placeholder="Find a team member…"
              maxLength={100}
              value={search}
              disabled={viewLocked}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              className="search-button"
              disabled={viewLocked}
              type="submit"
            >
              Search
            </button>
            {query.search && (
              <button
                className="clear-search"
                disabled={viewLocked}
                type="button"
                aria-label="Clear search"
                onClick={clearSearch}
              >
                ×
              </button>
            )}
          </form>
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
              →
            </span>
            <label>
              To
              <input
                type="date"
                value={range.to}
                disabled={viewLocked}
                required
                onChange={(event) =>
                  setRange((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
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
      </div>
      {rangeError && (
        <p role="alert" className="range-error">
          {rangeError}
        </p>
      )}
      <p className="summary-context">
        Page summary · all {data ? data.weeks.length : 'selected'} weeks ·{' '}
        {data ? data.people.length : '—'} people on this page
      </p>
      <div className="page-summary" aria-label="Summary of people on this page">
        <div className="summary-scope">
          <strong>{data ? data.people.length : '—'}</strong>
          <span>
            people shown
            <small>
              {query.search
                ? `Matching “${query.search}”`
                : 'Current roster page'}
            </small>
          </span>
        </div>
        <div className="summary-stat attention">
          <strong>{data ? overCount : '—'}</strong>
          <span>
            over capacity<small>At least one week in range</small>
          </span>
        </div>
        <div className="summary-stat">
          <strong>
            {data ? hours(allocated) : '—'}
            <em>h</em>
          </strong>
          <span>
            allocated<small>Shown people · full selected range</small>
          </span>
        </div>
        <div className="summary-stat">
          <strong>
            {data ? hours(available) : '—'}
            <em>h</em>
          </strong>
          <span>
            room to plan<small>Shown people · full selected range</small>
          </span>
        </div>
      </div>
      <div className="grid-context">
        <div>
          <span className="grid-title">Weekly allocation</span>
          <span className="grid-context-note">
            {data
              ? `${data.weeks.length} ${data.weeks.length === 1 ? 'week' : 'weeks'} · ${data.total} ${query.search ? 'matching people' : 'people'}`
              : loading
                ? 'Loading your team…'
                : 'Capacity unavailable'}
          </span>
        </div>
        <span className="edit-instruction">
          Select weekly capacity to edit <span aria-hidden="true">↗</span>
        </span>
      </div>
      {data && (
        <div className="mobile-week-picker" aria-label="Displayed week">
          <button
            className="icon-button"
            type="button"
            aria-label="Earlier displayed week"
            disabled={viewLocked || mobileWeek === 0}
            onClick={() => setMobileWeek((index) => Math.max(0, index - 1))}
          >
            ←
          </button>
          <span>
            <small>
              SHOWING WEEK {mobileWeek + 1} OF {data.weeks.length}
            </small>
            <strong>
              {currentMobileWeek
                ? dateRangeLabel(currentMobileWeek.start, currentMobileWeek.end)
                : ''}
            </strong>
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label="Later displayed week"
            disabled={viewLocked || mobileWeek >= data.weeks.length - 1}
            onClick={() =>
              setMobileWeek((index) =>
                Math.min(data.weeks.length - 1, index + 1),
              )
            }
          >
            →
          </button>
        </div>
      )}
      <div ref={gridPanel} className="grid-panel" aria-busy={loading}>
        {loading ? (
          <div className="grid-loading" role="status">
            <span className="loading-dot" />
            Loading capacity…
            <div className="skeleton-lines" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
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
                    Team member <span className="column-detail">A–Z</span>
                  </th>
                  <th scope="col" className="capacity-column">
                    Weekly capacity<span>Recurring limit</span>
                  </th>
                  {data.weeks.map((week, index) => (
                    <th
                      scope="col"
                      key={week.start}
                      className={`week-column ${index === mobileWeek ? 'mobile-active' : ''}`}
                    >
                      <span className="week-kicker">
                        WEEK {index + 1}{' '}
                        <span>
                          {dateLabel(week.start, { year: 'numeric' })}
                        </span>
                      </span>
                      <strong>
                        {dateLabel(week.start)}
                        <span className="week-end">
                          {' '}
                          – {dateLabel(week.end)}
                        </span>
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
                        <button
                          className="person-details-button"
                          disabled={viewLocked}
                          onClick={() => openDetails(person)}
                          aria-label={`View allocation details for ${person.name}`}
                        >
                          {person.name}
                        </button>
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
                        className={`week-cell ${index === mobileWeek ? 'mobile-active' : ''}`}
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
            <span className="state-icon">
              <SearchIcon />
            </span>
            <h2>
              {query.search ? 'No matching team members' : 'No people to show'}
            </h2>
            <p>
              {query.search
                ? `No names match “${query.search}”. Try a different name or clear your search.`
                : 'The roster is empty for this page.'}
            </p>
            <button
              className="primary-button"
              onClick={
                query.search
                  ? clearSearch
                  : () => setQuery((current) => ({ ...current, offset: 0 }))
              }
            >
              {query.search ? 'Show everyone' : 'Back to first page'}
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
        <span aria-hidden="true">↳</span> Capacity is a person’s recurring
        weekly limit. Changing it updates every week.
      </p>
      {details && (
        <AllocationDetails {...details} onClose={() => setDetails(null)} />
      )}
    </section>
  )
}
