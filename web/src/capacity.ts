export type Person = {
  id: number
  name: string
  weeklyHours: number
  allocatedHours: number[]
}
export type Week = { start: string; end: string }
export type Capacity = {
  from: string
  to: string
  weeks: Week[]
  people: Person[]
  total: number
  offset: number
  limit: number
}
export type Query = { from: string; to: string; offset: number }

const hourFormatter = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })
export const hours = (value: number) => hourFormatter.format(value)
export const dateLabel = (
  value: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
) =>
  new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(
    new Date(`${value}T12:00:00Z`),
  )

export function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function capacityInput(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null
  const result = Number(value)
  return Number.isFinite(result) && result >= 0 && result <= 168 ? result : null
}

export async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text()
    let message = body.trim()
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        const parsed: unknown = JSON.parse(body)
        if (
          parsed &&
          typeof parsed === 'object' &&
          'error' in parsed &&
          typeof parsed.error === 'string'
        )
          message = parsed.error
      } catch {
        message = ''
      }
    }
    throw new Error(message || `Request failed (${response.status}).`)
  }
  return response.json() as Promise<T>
}
