import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { FormEvent, ReactNode } from 'react'
import { useAppStore } from '../../store'
import {
  computeAllAvailability,
  recommendStartHere,
} from '../../utils/ordering'
import type { ItemAvailability } from '../../utils/ordering'
import { findDangerFlags } from '../../utils/onboarding'
import { groupRecurringItems, getEffectiveDueDate, dueDateLabel, localDateString } from '../../utils/recurring'
import type { ChecklistEntry, CustomItem, ItemImportance, ItemPriority, KBItem, UserAccess } from '../../types'

const IMPORTANCE_ORDER: Record<ItemImportance, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

// Sort order for the active list: 'now' first, then 'soon', then no opinion,
// then 'someday'/'unsure' (these go to a soft section instead). Smaller = earlier.
const PRIORITY_SORT: Record<string, number> = {
  now: 0,
  soon: 1,
  // null/undefined treated as 2 in the comparator
  someday: 3,
  unsure: 4,
}

// Priorities that route an item to the soft "Someday" section instead of the
// active list.
const SOMEDAY_PRIORITIES = new Set<ItemPriority>(['someday', 'unsure'])

// Days until expiration where we surface a small "expires {date}" indicator.
// Used for document_state.expiration_date — designed for IDs that are close
// to expiring and may shape the user's name-change timeline.
const EXPIRY_WARNING_DAYS = 90

function priorityRank(p: ItemPriority | null | undefined): number {
  if (p == null) return 2
  return PRIORITY_SORT[p] ?? 2
}

function entryExpirationDate(entry: ChecklistEntry | undefined): string | null {
  const ds = entry?.document_state
  if (!ds) return null
  if (ds.kind === 'name' || ds.kind === 'full') return ds.expiration_date ?? null
  return null
}

const TRACKS = ['legal', 'medical', 'social', 'personal', 'supporter'] as const
type TrackSlug = (typeof TRACKS)[number]

function canDoWithCurrentAccess(item: KBItem, access: UserAccess): boolean {
  const req = item.process?.access_requirements
  if (!req) return true
  const hasInternet = access.internet_home || access.internet_public_only
  const hasPrinter = access.printer_home || access.printer_access
  if (req.internet === 'required' && !hasInternet) return false
  if (req.printer === 'required' && !hasPrinter) return false
  if (req.phone && !access.phone_reliable) return false
  return true
}

function getProgressKey(completed: number, total: number): string {
  if (total === 0) return 'not_started'
  const ratio = completed / total
  if (ratio === 0) return 'not_started'
  if (ratio < 0.25) return 'getting_started'
  if (ratio < 0.5) return 'underway'
  if (ratio < 0.75) return 'well_along'
  if (ratio < 1) return 'nearly_done'
  return 'all_done'
}

// Effective intent for a checklist entry — absent field means 'update' (migration default)
function effectiveIntent(entry: ChecklistEntry | undefined): string {
  return entry?.intent ?? 'update'
}

function TrackButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-neutral-900 text-white'
          : 'text-neutral-600 hover:text-neutral-900'
      }`}
    >
      {children}
    </button>
  )
}

export default function Dashboard() {
  const { t } = useTranslation()
  const userData = useAppStore((s) => s.userData)
  const kb = useAppStore((s) => s.kb)
  const kbLoading = useAppStore((s) => s.kbLoading)
  const kbError = useAppStore((s) => s.kbError)
  const addCustomItem = useAppStore((s) => s.addCustomItem)

  const [activeTrack, setActiveTrack] = useState<TrackSlug | null>(null)
  const [accessFilter, setAccessFilter] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddName, setQuickAddName] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [showPolicyBlocked, setShowPolicyBlocked] = useState(false)

  const profile = userData.profile
  const access = profile.access

  const availability = useMemo(
    () => (kb ? computeAllAvailability(kb, userData) : new Map<string, ItemAvailability>()),
    [kb, userData]
  )

  const checklistSlugs = useMemo(
    () => new Set(Object.keys(userData.checklist)),
    [userData.checklist]
  )

  const dangerFlags = useMemo(
    () => (kb ? findDangerFlags(kb, userData) : []),
    [kb, userData]
  )

  const startHere = useMemo(() => {
    if (!kb) return []
    const recs = recommendStartHere(kb, userData, {
      max: 2,
      tracks: activeTrack ? [activeTrack] : undefined,
    })
    return checklistSlugs.size > 0
      ? recs.filter((r) => checklistSlugs.has(r.slug))
      : recs
  }, [kb, userData, activeTrack, checklistSlugs])

  // KB items split into available / blocked / policy_blocked / completed
  // A4: only items with intent === 'update' (or no intent) appear in the active list
  // Phase 14: items with priority 'someday' or 'unsure' route to a soft section
  // instead of the active list.
  const { availableNow, blockedItems, policyBlockedItems, completedItems, somedayKB } = useMemo(() => {
    const avail: ItemAvailability[] = []
    const blocked: ItemAvailability[] = []
    const policyBlocked: ItemAvailability[] = []
    const done: ItemAvailability[] = []
    const someday: ItemAvailability[] = []

    for (const [slug, a] of availability.entries()) {
      if (!checklistSlugs.has(slug)) continue
      const kbItem = kb?.items[slug]
      if (activeTrack && kbItem?.track !== activeTrack) continue
      if (accessFilter && kbItem && !canDoWithCurrentAccess(kbItem, access)) continue

      const entry = userData.checklist[slug]
      const intent = effectiveIntent(entry)

      // Items with intent !== 'update' are suppressed from the active list entirely
      if (intent !== 'update') continue

      const status = entry?.status ?? 'not_started'

      // C2: policy_blocked items and immutable items get their own quiet section
      if (status === 'policy_blocked' || kbItem?.immutable) {
        policyBlocked.push(a)
        continue
      }
      if (a.isSatisfying) {
        done.push(a)
        continue
      }
      const priority = entry?.priority
      if (priority && SOMEDAY_PRIORITIES.has(priority)) {
        someday.push(a)
        continue
      }
      if (a.available) {
        avail.push(a)
      } else {
        blocked.push(a)
      }
    }

    // Sort available list by priority ('now' first), then by importance.
    avail.sort((x, y) => {
      const xp = priorityRank(userData.checklist[x.slug]?.priority)
      const yp = priorityRank(userData.checklist[y.slug]?.priority)
      if (xp !== yp) return xp - yp
      const xi = IMPORTANCE_ORDER[kb?.items[x.slug]?.importance ?? 'medium'] ?? 4
      const yi = IMPORTANCE_ORDER[kb?.items[y.slug]?.importance ?? 'medium'] ?? 4
      return xi - yi
    })

    return {
      availableNow: avail,
      blockedItems: blocked,
      policyBlockedItems: policyBlocked,
      completedItems: done,
      somedayKB: someday,
    }
  }, [availability, checklistSlugs, kb, activeTrack, accessFilter, access, userData.checklist])

  // Custom items split by effective status, filtered by track
  // Source of truth is checklist[c.id]; fall back to c.status for un-migrated data
  const { customAvailable, customBlocked, customCompleted, somedayCustom } = useMemo(() => {
    const avail: CustomItem[] = []
    const blocked: CustomItem[] = []
    const done: CustomItem[] = []
    const someday: CustomItem[] = []

    for (const c of userData.custom_items) {
      if (activeTrack && c.track !== activeTrack) continue
      const entry = userData.checklist[c.id]
      const intent = effectiveIntent(entry)
      if (intent !== 'update') continue

      const priority = entry?.priority
      const status = entry?.status ?? c.status
      if (status === 'complete' || status === 'at_risk') done.push(c)
      else if (
        status === 'cant_right_now' ||
        status === 'policy_blocked' ||
        status === 'skipped' ||
        status === 'not_applicable'
      )
        blocked.push(c)
      else if (priority && SOMEDAY_PRIORITIES.has(priority)) someday.push(c)
      else avail.push(c)
    }

    // Sort active customs by priority too.
    avail.sort((x, y) => {
      const xp = priorityRank(userData.checklist[x.id]?.priority)
      const yp = priorityRank(userData.checklist[y.id]?.priority)
      return xp - yp
    })

    return { customAvailable: avail, customBlocked: blocked, customCompleted: done, somedayCustom: someday }
  }, [userData.custom_items, userData.checklist, activeTrack])

  // KB items not on the user's checklist — surfaced when open_doors is on or walk_with_me is active
  const openDoorsItems = useMemo(() => {
    if (!kb) return []
    const shouldShow =
      profile.presence.open_doors || profile.presence.overall_level === 'walk_with_me'
    if (!shouldShow) return []

    return Object.values(kb.items)
      .filter((item) => !checklistSlugs.has(item.slug))
      .filter((item) => !activeTrack || item.track === activeTrack)
      .sort((a, b) => (IMPORTANCE_ORDER[a.importance] ?? 4) - (IMPORTANCE_ORDER[b.importance] ?? 4))
      .slice(0, 5)
  }, [kb, profile.presence, checklistSlugs, activeTrack])

  // Unfiltered progress counts for the warm label (all tracks, intent='update' only)
  const { totalOnList, totalCompleted } = useMemo(() => {
    let total = 0
    let done = 0
    for (const slug of checklistSlugs) {
      const entry = userData.checklist[slug]
      if (effectiveIntent(entry) !== 'update') continue
      // Skip custom items here (counted separately below)
      if (slug.startsWith('custom-')) continue
      total++
      const a = availability.get(slug)
      if (a?.isSatisfying) done++
    }
    for (const c of userData.custom_items) {
      const entry = userData.checklist[c.id]
      if (effectiveIntent(entry) !== 'update') continue
      total++
      const status = entry?.status ?? c.status
      if (status === 'complete' || status === 'at_risk') done++
    }
    return { totalOnList: total, totalCompleted: done }
  }, [availability, checklistSlugs, userData.checklist, userData.custom_items])

  const today = useMemo(() => localDateString(), [])

  // C5: Checklist items with upcoming/overdue due_date or event_date, sorted by proximity
  const datedItems = useMemo(() => {
    const items: { slug: string; label: string; date: string; kind: 'due' | 'event' }[] = []

    for (const [slug, entry] of Object.entries(userData.checklist)) {
      if (effectiveIntent(entry) !== 'update') continue
      if (entry.status === 'complete' || entry.status === 'policy_blocked') continue

      const kbItem = kb?.items[slug]
      const customItem = userData.custom_items.find((c) => c.id === slug)
      const label = kbItem?.label ?? customItem?.label ?? slug

      if (entry.due_date) {
        items.push({ slug, label, date: entry.due_date, kind: 'due' })
      }
      if (entry.event_date) {
        items.push({ slug, label, date: entry.event_date, kind: 'event' })
      }
    }

    // Filter to overdue + next 30 days, sorted by date
    return items
      .filter(({ date }) => {
        const days = Math.round(
          (new Date(date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) /
            86_400_000
        )
        return days <= 30
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [userData.checklist, userData.custom_items, kb, today])

  // Recurring items grouped by urgency, filtered by active track
  const recurringGroups = useMemo(() => {
    const filtered = (userData.recurring_items ?? []).filter(
      (r) => !activeTrack || r.track === activeTrack
    )
    return groupRecurringItems(filtered, today)
  }, [userData.recurring_items, today, activeTrack])

  // Set of checklist slugs that have at least one undone past-due sub-task
  const pastDueSubTaskSlugs = useMemo(() => {
    const slugs = new Set<string>()
    for (const [slug, entry] of Object.entries(userData.checklist)) {
      if ((entry.sub_tasks ?? []).some((t) => !t.done && t.due_date && t.due_date < today)) {
        slugs.add(slug)
      }
    }
    return slugs
  }, [userData.checklist, today])

  // Items with revisit_at on or before today, surfaced as a quiet nudge banner.
  // Excludes items already completed or in the soft someday section so we don't
  // double-surface what's already visible.
  const revisitDue = useMemo(() => {
    const items: { slug: string; label: string; revisit_at: string }[] = []
    for (const [slug, entry] of Object.entries(userData.checklist)) {
      if (!entry.revisit_at) continue
      if (entry.revisit_at > today) continue
      if (effectiveIntent(entry) !== 'update') continue
      if (entry.status === 'complete') continue
      const kbItem = kb?.items[slug]
      const customItem = userData.custom_items.find((c) => c.id === slug)
      if (activeTrack && (kbItem?.track ?? customItem?.track) !== activeTrack) continue
      items.push({
        slug,
        label: kbItem?.label ?? customItem?.label ?? slug,
        revisit_at: entry.revisit_at,
      })
    }
    return items.sort((a, b) => a.revisit_at.localeCompare(b.revisit_at))
  }, [userData.checklist, userData.custom_items, kb, today, activeTrack])

  // Days-until helper for the expiry indicator. Returns null if no date.
  const daysUntil = (date: string | null): number | null => {
    if (!date) return null
    return Math.round(
      (new Date(date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) /
        86_400_000
    )
  }

  const progressKey = getProgressKey(totalCompleted, totalOnList)
  const allCompleted = completedItems.length + customCompleted.length
  const displayName = profile.display_name ?? profile.chosen_name

  const handleQuickAdd = (e: FormEvent) => {
    e.preventDefault()
    const name = quickAddName.trim()
    if (!name) return
    addCustomItem({
      label: name,
      description: '',
      category: activeTrack ?? 'personal',
      track: activeTrack ?? 'personal',
      notes: '',
    })
    setQuickAddName('')
    setQuickAddOpen(false)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="border-b border-neutral-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-sm font-medium text-neutral-900">
            {t('app.name')}
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/recurring" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t('dashboard.recurring_link')}
            </Link>
            <Link to="/people" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t('people_map.dashboard_link')}
            </Link>
            <Link to="/settings" className="text-sm text-neutral-600 hover:text-neutral-900">
              {t('dashboard.settings')}
            </Link>
          </div>
        </div>
      </header>

      {/* Track switcher */}
      <div className="border-b border-neutral-200 px-4">
        <div className="max-w-2xl mx-auto flex items-center gap-1 overflow-x-auto py-2">
          <TrackButton active={activeTrack === null} onClick={() => setActiveTrack(null)}>
            {t('dashboard.all_tracks')}
          </TrackButton>
          {TRACKS.map((track) => (
            <TrackButton
              key={track}
              active={activeTrack === track}
              onClick={() => setActiveTrack(activeTrack === track ? null : track)}
            >
              {t(`dashboard.tracks.${track}`)}
            </TrackButton>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        {/* KB error */}
        {kbError && (
          <div className="mb-6 px-4 py-3 bg-neutral-100 border border-neutral-300 rounded-lg text-sm text-neutral-700">
            {t('dashboard.kb_error')}
          </div>
        )}

        {/* Revisit nudge — items with revisit_at on or before today */}
        {revisitDue.length > 0 && (
          <div className="mb-6 px-4 py-3 border border-neutral-200 rounded-lg bg-neutral-50">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">
              {t('dashboard.revisit_section_heading')}
            </p>
            <p className="text-xs text-neutral-500 mb-2 leading-relaxed">
              {t('dashboard.revisit_section_intro')}
            </p>
            <ul className="space-y-1">
              {revisitDue.map((r) => (
                <li key={r.slug}>
                  <Link
                    to={`/item/${r.slug}`}
                    className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
                  >
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Danger flags banner */}
        {dangerFlags.length > 0 && (
          <div className="mb-6 px-4 py-3 border border-neutral-400 rounded-lg">
            <p className="text-sm font-medium text-neutral-900 mb-2">
              {t('dashboard.danger_banner_label')}
            </p>
            <ul className="space-y-1.5">
              {dangerFlags.map((flag) => (
                <li key={flag.slug}>
                  <Link
                    to={`/item/${flag.slug}`}
                    className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
                  >
                    {flag.label}
                  </Link>
                  {flag.note && (
                    <span className="text-xs text-neutral-500 ml-2">{flag.note}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Greeting + warm progress label */}
        <div className="mb-8">
          {displayName && (
            <h1 className="text-xl font-semibold text-neutral-900 mb-1">
              {t('dashboard.greet', { name: displayName })}
            </h1>
          )}
          {totalOnList > 0 && (
            <p className="text-sm text-neutral-600">
              {t(`dashboard.progress.${progressKey}`)}
            </p>
          )}
        </div>

        {/* Access filter toggle */}
        <label className="flex items-center gap-2 mb-8 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={accessFilter}
            onChange={(e) => setAccessFilter(e.target.checked)}
            className="w-4 h-4 accent-neutral-900"
          />
          <span className="text-sm text-neutral-600">{t('dashboard.access_filter')}</span>
        </label>

        {/* Loading indicator */}
        {kbLoading && (
          <p className="text-sm text-neutral-400 mb-6">{t('dashboard.kb_loading')}</p>
        )}

        {/* Recurring — overdue and due today */}
        {(recurringGroups.overdue.length > 0 || recurringGroups.dueToday.length > 0) && (
          <section className="mb-8" aria-labelledby="recurring-due-heading">
            <h2
              id="recurring-due-heading"
              className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3"
            >
              {t('dashboard.recurring_due_heading')}
            </h2>
            <div className="space-y-2">
              {[...recurringGroups.overdue, ...recurringGroups.dueToday].map((item) => {
                const due = getEffectiveDueDate(item)
                return (
                  <Link
                    key={item.id}
                    to="/recurring"
                    className="flex items-center justify-between px-4 py-3 border border-neutral-300 rounded-lg hover:border-neutral-500 transition-colors"
                  >
                    <span className="text-sm text-neutral-900">{item.label}</span>
                    <span className="text-xs text-neutral-500 ml-3 flex-shrink-0">
                      {due ? dueDateLabel(due, today) : ''}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* C5: Dated checklist items (deadline/event within 30 days or overdue) */}
        {datedItems.length > 0 && (
          <section className="mb-8" aria-labelledby="dated-heading">
            <h2
              id="dated-heading"
              className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3"
            >
              {t('dashboard.dated_heading')}
            </h2>
            <div className="space-y-2">
              {datedItems.map(({ slug, label, date, kind }) => (
                <Link
                  key={`${slug}-${kind}`}
                  to={`/item/${slug}`}
                  className="flex items-center justify-between px-4 py-3 border border-neutral-300 rounded-lg hover:border-neutral-500 transition-colors"
                >
                  <span className="text-sm text-neutral-900">{label}</span>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className="text-xs text-neutral-400">
                      {kind === 'event' ? t('item_detail.event_date_label') : t('item_detail.due_date_label')}
                    </span>
                    <span className="text-xs text-neutral-500">{dueDateLabel(date, today)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Start here */}
        {startHere.length > 0 && (
          <section className="mb-8" aria-labelledby="start-here-heading">
            <h2
              id="start-here-heading"
              className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3"
            >
              {t('dashboard.start_here')}
            </h2>
            <div className="space-y-2">
              {startHere.map((rec) => {
                const item = kb!.items[rec.slug]
                return (
                  <Link
                    key={rec.slug}
                    to={`/item/${rec.slug}`}
                    className="block px-4 py-3 border border-neutral-300 rounded-lg hover:border-neutral-500 transition-colors"
                  >
                    <div className="text-sm font-medium text-neutral-900">
                      {item?.label ?? rec.slug}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {t(`dashboard.start_here_reason.${rec.reason}`)}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Available now */}
        <section className="mb-8" aria-labelledby="available-heading">
          <h2
            id="available-heading"
            className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3"
          >
            {t('dashboard.available_now')}
          </h2>

          {availableNow.length === 0 && customAvailable.length === 0 ? (
            <p className="text-sm text-neutral-400 py-1">
              {totalOnList === 0 && !kbLoading
                ? t('dashboard.no_items_on_list')
                : t('dashboard.no_available')}
            </p>
          ) : (
            <div className="space-y-2">
              {availableNow.map((a) => {
                const item = kb!.items[a.slug]
                const entry = userData.checklist[a.slug]
                const hasPastDueSubTask = pastDueSubTaskSlugs.has(a.slug)
                const priority = entry?.priority ?? null
                const expDate = entryExpirationDate(entry)
                const expDays = daysUntil(expDate)
                return (
                  <Link
                    key={a.slug}
                    to={`/item/${a.slug}`}
                    className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg hover:border-neutral-400 transition-colors"
                  >
                    <span className="text-sm text-neutral-900">{item?.label ?? a.slug}</span>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0 flex-wrap justify-end">
                      {priority === 'now' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-900 text-white">
                          {t('dashboard.priority_now')}
                        </span>
                      )}
                      {priority === 'soon' && (
                        <span className="text-xs px-1.5 py-0.5 rounded border border-neutral-400 text-neutral-700">
                          {t('dashboard.priority_soon')}
                        </span>
                      )}
                      {expDate && expDays !== null && expDays <= EXPIRY_WARNING_DAYS && (
                        <span
                          className={`text-xs ${
                            expDays < 0 ? 'text-amber-700' : 'text-neutral-500'
                          }`}
                        >
                          {expDays < 0
                            ? t('item.doc_state.expired', { date: expDate })
                            : t('item.doc_state.expiring_soon', { date: expDate })}
                        </span>
                      )}
                      {hasPastDueSubTask && (
                        <span className="text-xs text-neutral-500" title={t('dashboard.subtask_overdue_hint')}>
                          {t('dashboard.subtask_overdue_flag')}
                        </span>
                      )}
                      {activeTrack === null && item?.track && (
                        <span className="text-xs text-neutral-400">
                          {t(`dashboard.tracks.${item.track}`)}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
              {customAvailable.map((c) => {
                const entry = userData.checklist[c.id]
                const priority = entry?.priority ?? null
                return (
                  <Link
                    key={c.id}
                    to={`/item/${c.id}`}
                    className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg hover:border-neutral-400 transition-colors"
                  >
                    <span className="text-sm text-neutral-900">{c.label}</span>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0 flex-wrap justify-end">
                      {priority === 'now' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-900 text-white">
                          {t('dashboard.priority_now')}
                        </span>
                      )}
                      {priority === 'soon' && (
                        <span className="text-xs px-1.5 py-0.5 rounded border border-neutral-400 text-neutral-700">
                          {t('dashboard.priority_soon')}
                        </span>
                      )}
                      {activeTrack === null && (
                        <span className="text-xs text-neutral-400">
                          {t(`dashboard.tracks.${c.track}`, { defaultValue: c.track })}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Blocked / waiting on */}
        {(blockedItems.length > 0 || customBlocked.length > 0) && (
          <section className="mb-8" aria-labelledby="blocked-heading">
            <h2
              id="blocked-heading"
              className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3"
            >
              {t('dashboard.blocked_section')}
            </h2>
            <div className="space-y-2">
              {blockedItems.map((a) => {
                const item = kb!.items[a.slug]
                return (
                  <Link
                    key={a.slug}
                    to={`/item/${a.slug}`}
                    className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg hover:border-neutral-400 transition-colors"
                  >
                    <span className="text-sm text-neutral-700">{item?.label ?? a.slug}</span>
                    {a.primaryBlockerLabel && (
                      <span className="text-xs text-neutral-500 ml-3 flex-shrink-0">
                        {t('dashboard.blocked', { blocker: a.primaryBlockerLabel })}
                      </span>
                    )}
                  </Link>
                )
              })}
              {customBlocked.map((c) => {
                const entry = userData.checklist[c.id]
                const status = entry?.status ?? c.status
                return (
                  <Link
                    key={c.id}
                    to={`/item/${c.id}`}
                    className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg hover:border-neutral-400 transition-colors"
                  >
                    <span className="text-sm text-neutral-700">{c.label}</span>
                    <span className="text-xs text-neutral-500 ml-3 flex-shrink-0">
                      {t(`item.status.${status}`)}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Someday — items with priority 'someday' or 'unsure' */}
        {(somedayKB.length > 0 || somedayCustom.length > 0) && (
          <section className="mb-8" aria-labelledby="someday-heading">
            <h2
              id="someday-heading"
              className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3"
            >
              {t('dashboard.someday_section_heading')}
            </h2>
            <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
              {t('dashboard.someday_section_intro')}
            </p>
            <div className="space-y-2">
              {somedayKB.map((a) => {
                const item = kb!.items[a.slug]
                const entry = userData.checklist[a.slug]
                const priority = entry?.priority ?? null
                return (
                  <Link
                    key={a.slug}
                    to={`/item/${a.slug}`}
                    className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg opacity-75 hover:opacity-100 transition-opacity"
                  >
                    <span className="text-sm text-neutral-700">{item?.label ?? a.slug}</span>
                    <span className="text-xs text-neutral-400 ml-3 flex-shrink-0">
                      {priority === 'unsure'
                        ? t('dashboard.priority_unsure')
                        : t('dashboard.priority_someday')}
                    </span>
                  </Link>
                )
              })}
              {somedayCustom.map((c) => {
                const entry = userData.checklist[c.id]
                const priority = entry?.priority ?? null
                return (
                  <Link
                    key={c.id}
                    to={`/item/${c.id}`}
                    className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg opacity-75 hover:opacity-100 transition-opacity"
                  >
                    <span className="text-sm text-neutral-700">{c.label}</span>
                    <span className="text-xs text-neutral-400 ml-3 flex-shrink-0">
                      {priority === 'unsure'
                        ? t('dashboard.priority_unsure')
                        : t('dashboard.priority_someday')}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* C2: Policy blocked / currently not possible (collapsible, quiet) */}
        {policyBlockedItems.length > 0 && (
          <section className="mb-8">
            <button
              type="button"
              onClick={() => setShowPolicyBlocked((v) => !v)}
              className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-neutral-400 hover:text-neutral-600 mb-3"
            >
              <span>{t('dashboard.policy_blocked_heading')}</span>
              <span className="font-normal text-neutral-300">({policyBlockedItems.length})</span>
              <span aria-hidden>{showPolicyBlocked ? '▲' : '▼'}</span>
            </button>

            {showPolicyBlocked && (
              <>
                <p className="text-xs text-neutral-400 mb-3">
                  {t('dashboard.policy_blocked_intro')}
                </p>
                <div className="space-y-2">
                  {policyBlockedItems.map((a) => {
                    const item = kb!.items[a.slug]
                    return (
                      <Link
                        key={a.slug}
                        to={`/item/${a.slug}`}
                        className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <span className="text-sm text-neutral-700">{item?.label ?? a.slug}</span>
                        <span className="text-xs text-neutral-400 ml-3 flex-shrink-0">
                          {item?.immutable
                            ? t('item_detail.immutable_heading')
                            : t('item.status.policy_blocked')}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {/* Open doors / walk_with_me resource surfacing */}
        {openDoorsItems.length > 0 && (
          <section className="mb-8" aria-labelledby="open-doors-heading">
            <h2
              id="open-doors-heading"
              className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3"
            >
              {t('dashboard.open_doors_heading')}
            </h2>
            <div className="space-y-2">
              {openDoorsItems.map((item) => (
                <Link
                  key={item.slug}
                  to={`/item/${item.slug}`}
                  className="block px-4 py-3 border border-neutral-200 rounded-lg hover:border-neutral-400 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-700">{item.label}</span>
                    {activeTrack === null && item.track && (
                      <span className="text-xs text-neutral-400 ml-3 flex-shrink-0">
                        {t(`dashboard.tracks.${item.track}`)}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{item.description}</p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recurring — open/intentions (no dates, standing intentions) */}
        {recurringGroups.intentions.length > 0 && (
          <section className="mb-8" aria-labelledby="recurring-intentions-heading">
            <h2
              id="recurring-intentions-heading"
              className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3"
            >
              {t('dashboard.recurring_intentions_heading')}
            </h2>
            <div className="space-y-2">
              {recurringGroups.intentions.map((item) => (
                <Link
                  key={item.id}
                  to="/recurring"
                  className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg hover:border-neutral-400 transition-colors"
                >
                  <span className="text-sm text-neutral-700">{item.label}</span>
                  {activeTrack === null && item.track && (
                    <span className="text-xs text-neutral-400 ml-3 flex-shrink-0">
                      {t(`dashboard.tracks.${item.track}`, { defaultValue: item.track })}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Completed (collapsed by default) */}
        {allCompleted > 0 && (
          <section className="mb-8">
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-neutral-500 hover:text-neutral-700 mb-3"
            >
              <span>{t('dashboard.completed_section')}</span>
              <span className="font-normal text-neutral-400">({allCompleted})</span>
              <span aria-hidden>{showCompleted ? '▲' : '▼'}</span>
            </button>

            {showCompleted && (
              <div className="space-y-2">
                {completedItems.map((a) => {
                  const item = kb!.items[a.slug]
                  return (
                    <Link
                      key={a.slug}
                      to={`/item/${a.slug}`}
                      className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
                    >
                      <span className="text-sm text-neutral-700">{item?.label ?? a.slug}</span>
                      <span className="text-xs text-neutral-400 ml-3 flex-shrink-0">
                        {t(`item.status.${a.status}`)}
                      </span>
                    </Link>
                  )
                })}
                {customCompleted.map((c) => {
                  const entry = userData.checklist[c.id]
                  const status = entry?.status ?? c.status
                  return (
                    <Link
                      key={c.id}
                      to={`/item/${c.id}`}
                      className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
                    >
                      <span className="text-sm text-neutral-700">{c.label}</span>
                      <span className="text-xs text-neutral-400 ml-3 flex-shrink-0">
                        {t(`item.status.${status}`)}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* Quick-add custom item */}
        <div className="pt-4 border-t border-neutral-200">
          {!quickAddOpen ? (
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="text-sm text-neutral-500 hover:text-neutral-900 underline-offset-2 hover:underline"
            >
              + {t('dashboard.quick_add')}
            </button>
          ) : (
            <form onSubmit={handleQuickAdd} className="flex items-center gap-2">
              <input
                type="text"
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                placeholder={t('dashboard.quick_add_placeholder')}
                className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-600"
                autoFocus
              />
              <button
                type="submit"
                disabled={!quickAddName.trim()}
                className="px-4 py-2 bg-neutral-900 text-white text-sm rounded-lg font-medium disabled:opacity-40"
              >
                {t('dashboard.quick_add')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickAddOpen(false)
                  setQuickAddName('')
                }}
                className="px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900"
              >
                {t('dashboard.quick_add_cancel')}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
