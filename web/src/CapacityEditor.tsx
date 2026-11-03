import { useRef, useState, type FormEvent } from 'react'
import { capacityInput, hours, type Person } from './capacity'

export function CapacityEditor({
  person,
  busy,
  save,
  onEditing,
}: {
  person: Person
  busy: boolean
  save: (id: number, hours: number) => Promise<void>
  onEditing: (id: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const editButton = useRef<HTMLButtonElement>(null)
  function close() {
    setEditing(false)
    onEditing(null)
    requestAnimationFrame(() => editButton.current?.focus())
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = capacityInput(draft)
    if (value === null) {
      setError('Enter 0–168 hours, with up to 2 decimal places.')
      return
    }
    setError('')
    try {
      await save(person.id, value)
      close()
      setSaved(true)
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Save failed. Please try again.',
      )
    }
  }
  if (!editing)
    return (
      <div className="capacity-control">
        <button
          ref={editButton}
          className="capacity-button"
          disabled={busy}
          aria-label={`Edit weekly capacity for ${person.name}`}
          onClick={() => {
            setDraft(String(person.weeklyHours))
            setEditing(true)
            onEditing(person.id)
            setSaved(false)
            setError('')
          }}
        >
          <span>
            {hours(person.weeklyHours)} <small>h / week</small>
          </span>
          <span className="edit-hint">Edit</span>
        </button>
        {saved && (
          <span className="saved-note" role="status">
            Saved
          </span>
        )}
      </div>
    )
  return (
    <form
      className="capacity-editor"
      onSubmit={submit}
      aria-label={`Capacity for ${person.name}`}
    >
      <label className="sr-only" htmlFor={`hours-${person.id}`}>
        Weekly hours for {person.name}
      </label>
      <input
        id={`hours-${person.id}`}
        type="number"
        inputMode="decimal"
        min="0"
        max="168"
        step="0.01"
        autoFocus
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          setError('')
        }}
        disabled={busy}
        aria-invalid={!!error}
        aria-describedby={error ? `error-${person.id}` : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) close()
        }}
      />
      <div className="editor-actions">
        <button className="save-button" disabled={busy} type="submit">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={close}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="field-error" id={`error-${person.id}`} role="alert">
          {error}
        </p>
      )}
      <span className="editor-help">Applies to every week</span>
    </form>
  )
}
