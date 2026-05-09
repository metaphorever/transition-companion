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
import type { CustomItem, ItemImportance, KBItem, UserAccess } from '../../types'

const IMPORTANCE_ORDER: Record<ItemImportance, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
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
    // When the user has explicit checklist items, only surface those as "start here"
    return checklistSlugs.size > 0
      ? recs.filter((r) => checklistSlugs.has(r.slug))
      : recs
  }, [kb, userData, activeTrack, checklistSlugs])

  // KB items split into available / blocked / completed, filtered by track + access
  const { availableNow, blockedItems, completedItems } = useMemo(() => {
    const avail: ItemAvailability[] = []
    const blocked: ItemAvailability[] = []
    const done: ItemAvailability[] = []

    for (const [slug, a] of availability.entries()) {
      if (!checklistSlugs.has(slug)) continue
      const kbItem = kb?.items[slug]
      if (activeTrack && kbItem?.track !== activeTrack) continue
      if (accessFilter && kbItem && !canDoWithCurrentAccess(kbItem, access)) continue

      if (a.isSatisfying) done.push(a)
      else if (a.available) avail.push(a)
      else blocked.push(a)
    }

    return { availableNow: avail, blockedItems: blocked, completedItems: done }
  }, [availability, checklistSlugs, kb, activeTrack, accessFilter, access])

  // Custom items split by effective status, filtered by track
  const { customAvailable, customBlocked, customCompleted } = useMemo(() => {
    const avail: CustomItem[] = []
    const blocked: CustomItem[] = []
    const done: CustomItem[] = []

    for (const c of userData.custom_items) {
      if (activeTrack && c.track !== activeTrack) continue
      if (c.status === 'complete' || c.status === 'at_risk') done.push(c)
      else if (
        c.status === 'cant_right_now' ||
        c.status === 'skipped' ||
        c.status === 'not_applicable'
      )
        blocked.push(c)
      else avail.push(c)
    }

    return { customAvailable: avail, customBlocked: blocked, customCompleted: done }
  }, [userData.custom_items, activeTrack])

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

  // Unfiltered progress counts for the warm label (all tracks)
  const { totalOnList, totalCompleted } = useMemo(() => {
    const total = checklistSlugs.size + userData.custom_items.length
    let done = 0
    for (const a of availability.values()) {
      if (checklistSlugs.has(a.slug) && a.isSatisfying) done++
    }
    done += userData.custom_items.filter(
      (c) => c.status === 'complete' || c.status === 'at_risk'
    ).length
    return { totalOnList: total, totalCompleted: done }
  }, [availability, checklistSlugs, userData.custom_items])

  const progressKey = getProgressKey(totalCompleted, totalOnList)
  const allCompleted = completedItems.length + customCompleted.length
  const displayName = profile.display_name ?? profile.chosen_name

  const handleQuickAdd = (e: FormEvent) => {
    e.preventDefault()
    const name = quickAddName.trim()
    if (!name) return
    addCustomItem({
      label: name,
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

        {/* Danger flags banner — links to item detail, copy is not inline */}
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
                return (
                  <Link
                    key={a.slug}
                    to={`/item/${a.slug}`}
                    className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg hover:border-neutral-400 transition-colors"
                  >
                    <span className="text-sm text-neutral-900">{item?.label ?? a.slug}</span>
                    {activeTrack === null && item?.track && (
                      <span className="text-xs text-neutral-400 ml-3 flex-shrink-0">
                        {t(`dashboard.tracks.${item.track}`)}
                      </span>
                    )}
                  </Link>
                )
              })}
              {customAvailable.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg"
                >
                  <span className="text-sm text-neutral-900">{c.label}</span>
                  {activeTrack === null && (
                    <span className="text-xs text-neutral-400 ml-3 flex-shrink-0">
                      {t(`dashboard.tracks.${c.track}`, { defaultValue: c.track })}
                    </span>
                  )}
                </div>
              ))}
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
              {customBlocked.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg"
                >
                  <span className="text-sm text-neutral-700">{c.label}</span>
                  <span className="text-xs text-neutral-500 ml-3 flex-shrink-0">
                    {t(`item.status.${c.status}`)}
                  </span>
                </div>
              ))}
            </div>
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
                {customCompleted.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg opacity-50"
                  >
                    <span className="text-sm text-neutral-700">{c.label}</span>
                    <span className="text-xs text-neutral-400 ml-3 flex-shrink-0">
                      {t(`item.status.${c.status}`)}
                    </span>
                  </div>
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
