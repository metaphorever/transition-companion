import { describe, it, expect } from 'vitest'
import { getEffectiveDueDate, groupRecurringItems, dueDateLabel } from './recurring'
import type { RecurringItem } from '../types'

function makeItem(overrides: Partial<RecurringItem>): RecurringItem {
  return {
    id: 'r1',
    label: 'Test',
    mode: 'fixed',
    interval_days: null,
    next_date: null,
    last_logged_at: null,
    track: 'personal',
    notes: '',
    ...overrides,
  }
}

describe('getEffectiveDueDate', () => {
  it('returns null for open mode', () => {
    expect(getEffectiveDueDate(makeItem({ mode: 'open' }))).toBeNull()
  })

  it('returns next_date for manual mode', () => {
    expect(getEffectiveDueDate(makeItem({ mode: 'manual', next_date: '2026-06-01' }))).toBe('2026-06-01')
  })

  it('returns null for manual mode with no next_date', () => {
    expect(getEffectiveDueDate(makeItem({ mode: 'manual', next_date: null }))).toBeNull()
  })

  it('computes due date from last_logged + interval for fixed mode', () => {
    const item = makeItem({ mode: 'fixed', last_logged_at: '2026-01-01', interval_days: 90 })
    expect(getEffectiveDueDate(item)).toBe('2026-04-01')
  })

  it('returns null for fixed mode with no last_logged_at', () => {
    expect(getEffectiveDueDate(makeItem({ mode: 'fixed', interval_days: 90, last_logged_at: null }))).toBeNull()
  })

  it('returns null for fixed mode with no interval_days', () => {
    expect(getEffectiveDueDate(makeItem({ mode: 'fixed', interval_days: null, last_logged_at: '2026-01-01' }))).toBeNull()
  })

  // C4: start_date as anchor when never logged
  it('uses start_date as anchor when last_logged_at is null', () => {
    const item = makeItem({ mode: 'fixed', last_logged_at: null, start_date: '2026-01-15', interval_days: 14 })
    expect(getEffectiveDueDate(item)).toBe('2026-01-29')
  })

  it('prefers last_logged_at over start_date when both present', () => {
    const item = makeItem({
      mode: 'fixed',
      last_logged_at: '2026-02-01',
      start_date: '2026-01-01',
      interval_days: 90,
    })
    // Should use last_logged_at (2026-02-01 + 90d), not start_date
    expect(getEffectiveDueDate(item)).toBe('2026-05-02')
  })

  it('returns null when fixed has no last_logged_at and no start_date', () => {
    expect(getEffectiveDueDate(makeItem({ mode: 'fixed', interval_days: 30, last_logged_at: null }))).toBeNull()
  })
})

describe('groupRecurringItems', () => {
  const today = '2026-05-09'

  it('puts overdue items in overdue group', () => {
    const item = makeItem({ mode: 'manual', next_date: '2026-05-01' })
    const groups = groupRecurringItems([item], today)
    expect(groups.overdue).toHaveLength(1)
    expect(groups.dueToday).toHaveLength(0)
  })

  it('puts due-today items in dueToday group', () => {
    const item = makeItem({ mode: 'manual', next_date: today })
    const groups = groupRecurringItems([item], today)
    expect(groups.dueToday).toHaveLength(1)
    expect(groups.overdue).toHaveLength(0)
  })

  it('puts future items in upcoming group', () => {
    const item = makeItem({ mode: 'manual', next_date: '2026-06-01' })
    const groups = groupRecurringItems([item], today)
    expect(groups.upcoming).toHaveLength(1)
  })

  it('puts open-mode items in intentions group', () => {
    const item = makeItem({ mode: 'open' })
    const groups = groupRecurringItems([item], today)
    expect(groups.intentions).toHaveLength(1)
  })

  it('puts fixed items with no date in intentions group', () => {
    const item = makeItem({ mode: 'fixed', interval_days: 30, last_logged_at: null })
    const groups = groupRecurringItems([item], today)
    expect(groups.intentions).toHaveLength(1)
  })
})

describe('dueDateLabel', () => {
  const today = '2026-05-09'

  it('returns "today" for same date', () => {
    expect(dueDateLabel(today, today)).toBe('today')
  })

  it('returns "tomorrow" for next day', () => {
    expect(dueDateLabel('2026-05-10', today)).toBe('tomorrow')
  })

  it('labels overdue correctly', () => {
    expect(dueDateLabel('2026-05-01', today)).toBe('8d overdue')
  })

  it('labels upcoming in days', () => {
    expect(dueDateLabel('2026-05-14', today)).toBe('in 5d')
  })

  it('labels upcoming in weeks', () => {
    expect(dueDateLabel('2026-05-30', today)).toBe('in 3w')
  })

  it('labels far future in months', () => {
    expect(dueDateLabel('2026-08-09', today)).toBe('in 3mo')
  })
})
