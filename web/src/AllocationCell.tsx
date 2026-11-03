import { hours } from './capacity'

export function AllocationCell({
  allocated,
  capacity,
}: {
  allocated: number
  capacity: number
}) {
  const over = allocated > capacity
  const percentage =
    capacity > 0
      ? Math.min(100, (allocated / capacity) * 100)
      : allocated > 0
        ? 100
        : 0
  return (
    <div
      className={`allocation ${over ? 'over' : allocated === 0 ? 'unallocated' : ''}`}
    >
      <div className="allocation-numbers">
        <strong>
          {hours(allocated)}
          <span> h</span>
        </strong>
        <span>/ {hours(capacity)} h</span>
      </div>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${percentage}%` }} />
      </div>
      <span className="allocation-caption">
        {over
          ? `${hours(allocated - capacity)} h over capacity`
          : allocated === 0
            ? 'No allocation'
            : `${hours(capacity - allocated)} h available`}
      </span>
    </div>
  )
}
