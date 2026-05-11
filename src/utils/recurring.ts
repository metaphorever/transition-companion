import type { RecurringItem } from '../types'

// Returns a local YYYY-MM-DD string for the given Date (or now).
// Using local date arithmetic throughout (not UTC) avoids the timezone
// boundary bug where "due tomorrow" appears as "due today" for UTC-offset users.
export function localDateString(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Returns YYYY-MM-DD effective due date, or null when no date applies.
// fixed: anchor (start_date when never logged, else last_logged_at) + interval_days
// manual: the stored next_date
// open: null (standing intention, never overdue)
export function getEffectiveDueDate(item: RecurringItem): string | null {
  if (item.mode === 'open') return null
  if (item.mode === 'manual') return item.next_date
  // fixed — use start_date as anchor when never logged (enables staggered schedules)
  if (!item.interval_days) return null
  const anchor = item.last_logged_at ?? item.start_date ?? null
  if (!anchor) return null
  // noon local time avoids DST boundary edge cases in setDate arithmetic
  const d = new Date(anchor + 'T12:00:00')
  d.setDate(d.getDate() + item.interval_days)
  return localDateString(d)
}

export interface RecurringGroups {
  overdue: RecurringItem[]
  dueToday: RecurringItem[]
  upcoming: RecurringItem[]
  intentions: RecurringItem[]  // open mode or fixed/manual with no date yet
}

export function groupRecurringItems(items: RecurringItem[], today: string): RecurringGroups {
  const overdue: RecurringItem[] = []
  const dueToday: RecurringItem[] = []
  const upcoming: RecurringItem[] = []
  const intentions: RecurringItem[] = []

  for (const item of items) {
    const due = getEffectiveDueDate(item)
    if (due === null) {
      intentions.push(item)
    } else if (due < today) {
      overdue.push(item)
    } else if (due === today) {
      dueToday.push(item)
    } else {
      upcoming.push(item)
    }
  }

  return { overdue, dueToday, upcoming, intentions }
}

// Returns a human-readable relative label for a due date relative to today.
// Both `due` and `today` must be local YYYY-MM-DD strings for correct results.
export function dueDateLabel(due: string, today: string): string {
  if (due === today) return 'today'
  // noon-based parsing avoids DST edge cases in day-difference arithmetic
  const dueMs = new Date(due + 'T12:00:00').getTime()
  const todayMs = new Date(today + 'T12:00:00').getTime()
  const days = Math.round((dueMs - todayMs) / 86_400_000)
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 1) return 'tomorrow'
  if (days <= 14) return `in ${days}d`
  if (days <= 60) return `in ${Math.round(days / 7)}w`
  return `in ${Math.round(days / 30)}mo`
}
