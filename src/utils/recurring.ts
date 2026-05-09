import type { RecurringItem } from '../types'

// Returns YYYY-MM-DD effective due date, or null when no date applies.
// fixed: last_logged_at + interval_days (never stored; always derived)
// manual: the stored next_date
// open: null (standing intention, never overdue)
export function getEffectiveDueDate(item: RecurringItem): string | null {
  if (item.mode === 'open') return null
  if (item.mode === 'manual') return item.next_date
  // fixed — use UTC methods to avoid timezone off-by-one
  if (!item.last_logged_at || !item.interval_days) return null
  const d = new Date(item.last_logged_at + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + item.interval_days)
  return d.toISOString().split('T')[0]
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
// Used on item cards in the dashboard.
export function dueDateLabel(due: string, today: string): string {
  if (due === today) return 'today'
  const dueMs = new Date(due).getTime()
  const todayMs = new Date(today).getTime()
  const days = Math.round((dueMs - todayMs) / 86_400_000)
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 1) return 'tomorrow'
  if (days <= 14) return `in ${days}d`
  if (days <= 60) return `in ${Math.round(days / 7)}w`
  return `in ${Math.round(days / 30)}mo`
}
