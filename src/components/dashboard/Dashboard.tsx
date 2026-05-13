import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { FormEvent, ReactNode } from 'react'
import { useAppStore } from '../../store'
import {
  computeAllAvailability,
  isActiveStoredBlocker,
  recommendStartHere,
} from '../../utils/ordering'
import type { ItemAvailability } from '../../utils/ordering'
import { findDangerFlags } from '../../utils/onboarding'
import { groupRecurringItems, getEffectiveDueDate, dueDateLabel, localDateString } from '../../utils/recurring'
import type {
  Blocker,
  ChecklistEntry,
  ItemImportance,
  ItemPriority,
  ItemStatus,
  KBItem,
  UserAccess,
} from '../../types'

// Statuses a resolution task must hit for its parent to show as "resolve-ready"
// in the dashboard nudge surface (presence > just_the_path).
const RESOLUTION_COMPLETE_STATUSES: ItemStatus[] = ['complete', 'at_risk']

type DashboardBucket = 'active' | 'working' | 'waiting' | 'completed' | 'someday' | null

interface BucketRow {
  id: string
  label: string
  track: string
  status: ItemStatus
  priority: ItemPriority | null
  importance: ItemImportance
  immutable: boolean
  expirationDate: string | null
  primaryBlockerLabel: string | null
  hasPastDueSubTask: boolean
}

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

// Unified row renderer for the Active / Working on blockers / Waiting buckets.
// Variant tunes the visual treatment without diverging the data shape.
function BucketItemRow({
  row,
  variant,
  showTrack,
  daysUntil,
  t,
}: {
  row: BucketRow
  variant: 'active' | 'working' | 'waiting'
  showTrack: boolean
  daysUntil: (date: string | null) => number | null
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const expDays = daysUntil(row.expirationDate)
  const linkClass =
    variant === 'waiting'
      ? 'flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg opacity-60 hover:opacity-100 transition-opacity'
      : 'flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg hover:border-neutral-400 transition-colors'
  const labelClass = variant === 'active' ? 'text-sm text-neutral-900' : 'text-sm text-neutral-700'

  return (
    <Link to={`/item/${row.id}`} className={linkClass}>
      <span className={labelClass}>{row.label}</span>
      <div className="flex items-center gap-2 ml-3 flex-shrink-0 flex-wrap justify-end">
        {variant === 'active' && row.priority === 'now' && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-900 text-white">
            {t('dashboard.priority_now')}
          </span>
        )}
        {variant === 'active' && row.priority === 'soon' && (
          <span className="text-xs px-1.5 py-0.5 rounded border border-neutral-400 text-neutral-700">
            {t('dashboard.priority_soon')}
          </span>
        )}
        {variant === 'working' && row.primaryBlockerLabel && (
          <span className="text-xs text-neutral-500">
            {t('dashboard.blocked', { blocker: row.primaryBlockerLabel })}
          </span>
        )}
        {variant === 'waiting' && (
          <span className="text-xs text-neutral-400">
            {row.immutable
              ? t('item_detail.immutable_heading')
              : row.primaryBlockerLabel
                ? t('dashboard.blocked', { blocker: row.primaryBlockerLabel })
                : t(`item.status.${row.status}`)}
          </span>
        )}
        {row.expirationDate && expDays !== null && expDays <= EXPIRY_WARNING_DAYS && (
          <span className={`text-xs ${expDays < 0 ? 'text-amber-700' : 'text-neutral-500'}`}>
            {expDays < 0
              ? t('item.doc_state.expired', { date: row.expirationDate })
              : t('item.doc_state.expiring_soon', { date: row.expirationDate })}
          </span>
        )}
        {row.hasPastDueSubTask && (
          <span className="text-xs text-neutral-500" title={t('dashboard.subtask_overdue_hint')}>
            {t('dashboard.subtask_overdue_flag')}
          </span>
        )}
        {showTrack && row.track && (
          <span className="text-xs text-neutral-400">
            {t(`dashboard.tracks.${row.track}`, { defaultValue: row.track })}
          </span>
        )}
      </div>
    </Link>
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

  // Hoisted above bucket compute so categorization can reference them.
  const today = useMemo(() => localDateString(), [])
  const pastDueSubTaskSlugs = useMemo(() => {
    const slugs = new Set<string>()
    for (const [slug, entry] of Object.entries(userData.checklist)) {
      if ((entry.sub_tasks ?? []).some((t) => !t.done && t.due_date && t.due_date < today)) {
        slugs.add(slug)
      }
    }
    return slugs
  }, [userData.checklist, today])

  // Phase 15 Stage B: unified bucket categorization across KB and custom items.
  //
  //   active  — no active blockers, no graph dependencies unmet, status not in
  //             {policy_blocked, cant_right_now, immutable}, not satisfying,
  //             priority not in {someday, unsure}.
  //   working — only resolvable active blockers (no out-of-control), OR (KB only)
  //             unmet document dependencies. The resolution path is the user's
  //             to walk.
  //   waiting — any out-of-control active blocker, OR status policy_blocked, OR
  //             (KB only) immutable item. Quiet. Collapsible.
  //
  // Items with intent !== 'update' are excluded entirely (Phase 12 D-9).
  const { activeRows, workingRows, waitingRows, completedRows, somedayRows } = useMemo(() => {
    const active: BucketRow[] = []
    const working: BucketRow[] = []
    const waiting: BucketRow[] = []
    const done: BucketRow[] = []
    const someday: BucketRow[] = []

    function categorize(
      id: string,
      label: string,
      track: string,
      entry: ChecklistEntry | undefined,
      kbItem: KBItem | undefined,
      availability: ItemAvailability | undefined
    ): void {
      if (effectiveIntent(entry) !== 'update') return
      const status: ItemStatus = entry?.status ?? 'not_started'
      const priority = entry?.priority ?? null
      const importance: ItemImportance = kbItem?.importance ?? 'medium'
      const immutable = !!kbItem?.immutable
      const expirationDate = entryExpirationDate(entry)
      const hasPastDueSubTask = pastDueSubTaskSlugs.has(id)
      const isSatisfying = availability?.isSatisfying ?? (status === 'complete' || status === 'at_risk')

      const activeBlockers: Blocker[] = (entry?.blockers ?? []).filter(isActiveStoredBlocker)
      const hasOutOfControl = activeBlockers.some((b) => b.resolution_mode === 'out_of_control')
      const hasResolvable = activeBlockers.some((b) => b.resolution_mode === 'resolvable')
      const documentBlocked = availability?.documentBlocked ?? false

      // Pick a primary blocker label for working/waiting rendering.
      let primaryBlockerLabel: string | null = null
      if (activeBlockers.length > 0) {
        primaryBlockerLabel = activeBlockers[0].description ?? null
      } else if (availability?.primaryBlockerLabel) {
        primaryBlockerLabel = availability.primaryBlockerLabel
      }

      const row: BucketRow = {
        id,
        label,
        track,
        status,
        priority,
        importance,
        immutable,
        expirationDate,
        primaryBlockerLabel,
        hasPastDueSubTask,
      }

      // Waiting: out-of-control blocker, policy_blocked status, or immutable.
      if (hasOutOfControl || status === 'policy_blocked' || immutable) {
        waiting.push(row)
        return
      }
      if (isSatisfying) {
        done.push(row)
        return
      }
      if (priority && SOMEDAY_PRIORITIES.has(priority)) {
        someday.push(row)
        return
      }
      // Working: resolvable blocker OR graph-unmet dependency.
      if (hasResolvable || documentBlocked) {
        working.push(row)
        return
      }
      // status that means "I can't right now" but no structured blocker yet —
      // surface in waiting so the user notices it isn't on the active list.
      if (
        status === 'cant_right_now' ||
        status === 'skipped' ||
        status === 'not_applicable'
      ) {
        waiting.push(row)
        return
      }
      active.push(row)
    }

    // KB items
    for (const [slug, a] of availability.entries()) {
      if (!checklistSlugs.has(slug)) continue
      const kbItem = kb?.items[slug]
      if (activeTrack && kbItem?.track !== activeTrack) continue
      if (accessFilter && kbItem && !canDoWithCurrentAccess(kbItem, access)) continue
      const entry = userData.checklist[slug]
      categorize(slug, kbItem?.label ?? slug, kbItem?.track ?? 'personal', entry, kbItem, a)
    }
    // Custom items
    for (const c of userData.custom_items) {
      if (activeTrack && c.track !== activeTrack) continue
      const entry = userData.checklist[c.id]
      categorize(c.id, c.label, c.track, entry, undefined, undefined)
    }

    // Sort: priority first ('now' → 'soon' → unset), then importance.
    const sortByPriorityThenImportance = (x: BucketRow, y: BucketRow) => {
      const xp = priorityRank(x.priority)
      const yp = priorityRank(y.priority)
      if (xp !== yp) return xp - yp
      return (IMPORTANCE_ORDER[x.importance] ?? 4) - (IMPORTANCE_ORDER[y.importance] ?? 4)
    }
    active.sort(sortByPriorityThenImportance)
    working.sort(sortByPriorityThenImportance)

    return {
      activeRows: active,
      workingRows: working,
      waitingRows: waiting,
      completedRows: done,
      somedayRows: someday,
    }
  }, [
    availability,
    checklistSlugs,
    kb,
    activeTrack,
    accessFilter,
    access,
    userData.checklist,
    userData.custom_items,
    pastDueSubTaskSlugs,
  ])

  // Dashboard-level confirm-resolve nudge for presence > just_the_path.
  // Surfaces parent items where any active resolvable blocker has a resolution
  // task that has flipped to complete/at_risk — the user can mark the blocker
  // resolved on the parent's item-detail page.
  const resolveReadyParents = useMemo(() => {
    const overallLevel = profile.presence.overall_level
    if (overallLevel === 'just_the_path' && !profile.presence.open_doors) return []

    const results: { id: string; label: string }[] = []
    for (const [parentSlug, entry] of Object.entries(userData.checklist)) {
      if (effectiveIntent(entry) !== 'update') continue
      let anyReady = false
      for (const b of entry.blockers) {
        if (!isActiveStoredBlocker(b)) continue
        if (b.resolution_mode !== 'resolvable') continue
        const taskIds = b.resolution_task_ids ?? []
        for (const id of taskIds) {
          const taskEntry = userData.checklist[id]
          const taskStatus = taskEntry?.status
          if (taskStatus && RESOLUTION_COMPLETE_STATUSES.includes(taskStatus)) {
            anyReady = true
            break
          }
        }
        if (anyReady) break
      }
      if (!anyReady) continue
      const kbItem = kb?.items[parentSlug]
      const customItem = userData.custom_items.find((c) => c.id === parentSlug)
      if (activeTrack && (kbItem?.track ?? customItem?.track) !== activeTrack) continue
      results.push({ id: parentSlug, label: kbItem?.label ?? customItem?.label ?? parentSlug })
    }
    return results
  }, [userData.checklist, userData.custom_items, kb, profile.presence, activeTrack])

  // Dashboard-level policy-changed nudge for presence > just_the_path.
  // Surfaces parents that have an active policy blocker whose linked KB
  // condition's status_date has advanced past the blocker's own status_date —
  // i.e. policy has moved since the user noted it blocked.
  const policyChangedParents = useMemo(() => {
    const overallLevel = profile.presence.overall_level
    if (overallLevel === 'just_the_path' && !profile.presence.open_doors) return []
    if (!kb) return []

    const results: { id: string; label: string }[] = []
    for (const [parentSlug, entry] of Object.entries(userData.checklist)) {
      if (effectiveIntent(entry) !== 'update') continue
      let policyMoved = false
      for (const b of entry.blockers) {
        if (!isActiveStoredBlocker(b)) continue
        if (b.resolution_mode !== 'out_of_control') continue
        if (b.out_of_control_kind !== 'policy') continue
        if (!b.kb_condition_ref) continue
        const cond = kb.conditions?.[b.kb_condition_ref]
        if (!cond) continue
        if (cond.status_date > b.status_date) {
          policyMoved = true
          break
        }
      }
      if (!policyMoved) continue
      const kbItem = kb.items[parentSlug]
      const customItem = userData.custom_items.find((c) => c.id === parentSlug)
      if (activeTrack && (kbItem?.track ?? customItem?.track) !== activeTrack) continue
      results.push({ id: parentSlug, label: kbItem?.label ?? customItem?.label ?? parentSlug })
    }
    return results
  }, [userData.checklist, userData.custom_items, kb, profile.presence, activeTrack])

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
  const allCompleted = completedRows.length
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

        {/* Confirm-resolve nudge (presence > just_the_path) */}
        {resolveReadyParents.length > 0 && (
          <div className="mb-6 px-4 py-3 border border-neutral-400 rounded-lg">
            <p className="text-sm font-medium text-neutral-900 mb-1">
              {t('dashboard.confirm_resolve_nudge_heading')}
            </p>
            <p className="text-xs text-neutral-600 mb-2 leading-relaxed">
              {t('dashboard.confirm_resolve_nudge_intro')}
            </p>
            <ul className="space-y-1">
              {resolveReadyParents.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/item/${p.id}`}
                    className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Policy-changed nudge (presence > just_the_path) */}
        {policyChangedParents.length > 0 && (
          <div className="mb-6 px-4 py-3 border border-neutral-400 rounded-lg">
            <p className="text-sm font-medium text-neutral-900 mb-1">
              {t('dashboard.policy_changed_nudge_heading')}
            </p>
            <p className="text-xs text-neutral-600 mb-2 leading-relaxed">
              {t('dashboard.policy_changed_nudge_intro')}
            </p>
            <ul className="space-y-1">
              {policyChangedParents.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/item/${p.id}`}
                    className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Active — ready to work on */}
        <section className="mb-8" aria-labelledby="active-heading">
          <h2
            id="active-heading"
            className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1"
          >
            {t('dashboard.active_section')}
          </h2>
          <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
            {t('dashboard.active_section_intro')}
          </p>

          {activeRows.length === 0 ? (
            <p className="text-sm text-neutral-400 py-1">
              {totalOnList === 0 && !kbLoading
                ? t('dashboard.no_items_on_list')
                : t('dashboard.no_available')}
            </p>
          ) : (
            <div className="space-y-2">
              {activeRows.map((row) => (
                <BucketItemRow
                  key={row.id}
                  row={row}
                  variant="active"
                  showTrack={activeTrack === null}
                  daysUntil={daysUntil}
                  t={t}
                />
              ))}
            </div>
          )}
        </section>

        {/* Working on blockers — resolvable blockers, the path is yours to walk */}
        {workingRows.length > 0 && (
          <section className="mb-8" aria-labelledby="working-heading">
            <h2
              id="working-heading"
              className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1"
            >
              {t('dashboard.working_on_blockers_section')}
            </h2>
            <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
              {t('dashboard.working_on_blockers_intro')}
            </p>
            <div className="space-y-2">
              {workingRows.map((row) => (
                <BucketItemRow
                  key={row.id}
                  row={row}
                  variant="working"
                  showTrack={activeTrack === null}
                  daysUntil={daysUntil}
                  t={t}
                />
              ))}
            </div>
          </section>
        )}

        {/* Someday — items with priority 'someday' or 'unsure' */}
        {somedayRows.length > 0 && (
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
              {somedayRows.map((row) => (
                <Link
                  key={row.id}
                  to={`/item/${row.id}`}
                  className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg opacity-75 hover:opacity-100 transition-opacity"
                >
                  <span className="text-sm text-neutral-700">{row.label}</span>
                  <span className="text-xs text-neutral-400 ml-3 flex-shrink-0">
                    {row.priority === 'unsure'
                      ? t('dashboard.priority_unsure')
                      : t('dashboard.priority_someday')}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Waiting — out-of-control blockers, policy_blocked, immutable. Collapsible. */}
        {waitingRows.length > 0 && (
          <section className="mb-8">
            <button
              type="button"
              onClick={() => setShowPolicyBlocked((v) => !v)}
              className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-neutral-400 hover:text-neutral-600 mb-2"
            >
              <span>{t('dashboard.waiting_section')}</span>
              <span className="font-normal text-neutral-300">({waitingRows.length})</span>
              <span aria-hidden>{showPolicyBlocked ? '▲' : '▼'}</span>
            </button>

            {showPolicyBlocked && (
              <>
                <p className="text-xs text-neutral-400 mb-3 leading-relaxed">
                  {t('dashboard.waiting_section_intro')}
                </p>
                <div className="space-y-2">
                  {waitingRows.map((row) => (
                    <BucketItemRow
                      key={row.id}
                      row={row}
                      variant="waiting"
                      showTrack={activeTrack === null}
                      daysUntil={daysUntil}
                      t={t}
                    />
                  ))}
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
                {completedRows.map((row) => (
                  <Link
                    key={row.id}
                    to={`/item/${row.id}`}
                    className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
                  >
                    <span className="text-sm text-neutral-700">{row.label}</span>
                    <span className="text-xs text-neutral-400 ml-3 flex-shrink-0">
                      {t(`item.status.${row.status}`)}
                    </span>
                  </Link>
                ))}
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
