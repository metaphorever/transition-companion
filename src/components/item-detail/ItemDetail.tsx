import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store'
import BlockersSection from './BlockersSection'
import type {
  ChecklistEntry,
  GenderMarkerChange,
  ItemStatus,
  KBItem,
  PresenceLevel,
  ProcessMode,
  SubTask,
  UserProfile,
} from '../../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALL_STATUSES: ItemStatus[] = [
  'not_started',
  'in_progress',
  'complete',
  'cant_right_now',
  'at_risk',
  'revoked',
  'skipped',
  'not_applicable',
]

const DEFAULT_ENTRY: ChecklistEntry = {
  status: 'not_started',
  completed_at: null,
  blockers: [],
  notes: '',
  custom_fields: {},
  sub_tasks: [],
}

function getEffectiveLevel(profile: UserProfile, track: string): PresenceLevel {
  return (profile.presence.per_track[track] as PresenceLevel | undefined) ?? profile.presence.overall_level
}

function fmtMonthYear(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } catch {
    return ''
  }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

function fmtSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const MODE_LABEL: Record<ProcessMode, string> = {
  online: 'Online',
  in_person: 'In person',
  mail: 'By mail',
  phone: 'By phone',
  preparation: 'Preparation',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-sm font-medium text-neutral-900">
            Transition Companion
          </Link>
          <Link to="/dashboard" className="text-sm text-neutral-600 hover:text-neutral-900">
            {t('item_detail.back')}
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        {children}
      </main>
    </div>
  )
}

function AtRiskAlert({ entry, item }: { entry: ChecklistEntry; item: KBItem }) {
  const { t } = useTranslation()
  const completedOn = entry.completed_at ? fmtDate(entry.completed_at) : null
  const gmc = item.gender_marker_change
  const advocacyLinks = gmc?.applies ? gmc.advocacy_links : []

  return (
    <div
      className="mb-6 px-4 py-4 border border-neutral-400 rounded-lg"
      role="alert"
      aria-labelledby="at-risk-heading"
    >
      <p id="at-risk-heading" className="text-sm font-semibold text-neutral-900 mb-2">
        {t('item_detail.at_risk_heading')}
      </p>
      {completedOn && (
        <p className="text-sm text-neutral-700 mb-1">
          {t('item_detail.at_risk_completed_on', { date: completedOn })}
        </p>
      )}
      <p className="text-sm text-neutral-700 mb-3">
        {t('item_detail.at_risk_body')}
      </p>
      <p className="text-sm text-neutral-700 mb-1">
        {t('item_detail.at_risk_action')}
      </p>
      {advocacyLinks.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-2 mb-2">
          {advocacyLinks.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-neutral-500 mt-2">{t('item_detail.at_risk_legal_note')}</p>
    </div>
  )
}

// Alert for user's item status = revoked
// Copy follows design doc Alert Messaging Guidelines.
// CARRYOVER NOTE: copy in this block needs Opus review (see CLAUDE.md Phase 5 notes).
function RevokedAlert({ entry }: { entry: ChecklistEntry }) {
  const { t } = useTranslation()
  const revokedDate = entry.revoked_at ? fmtDate(entry.revoked_at) : null
  const completedMonth = entry.completed_at ? fmtMonthYear(entry.completed_at) : null

  const bodyKey =
    revokedDate && completedMonth
      ? 'item_detail.revoked_body_with_completion'
      : 'item_detail.revoked_body_no_completion'

  if (!revokedDate) return null

  return (
    <div
      className="mb-6 px-4 py-4 border border-neutral-400 rounded-lg"
      role="alert"
      aria-labelledby="revoked-heading"
    >
      <p id="revoked-heading" className="text-sm font-semibold text-neutral-900 mb-2">
        {t('item_detail.revoked_heading')}
      </p>
      <p className="text-sm text-neutral-700 mb-3">
        {t(bodyKey, { revoked_date: revokedDate, completed_month: completedMonth ?? '' })}
      </p>
      <p className="text-sm text-neutral-700 mb-1">
        {t('item_detail.revoked_action')}
      </p>
      <p className="text-xs text-neutral-500 mt-2">{t('item_detail.revoked_legal_note')}</p>
    </div>
  )
}

// KB-level danger / caution / unknown / varies / unavailable banner
function GmcBanner({ gmc }: { gmc: GenderMarkerChange }) {
  const { t } = useTranslation()

  const headingKey: Record<string, string> = {
    danger: 'item_detail.gmc_danger_heading',
    caution: 'item_detail.gmc_caution_heading',
    unavailable: 'item_detail.gmc_unavailable_heading',
    varies: 'item_detail.gmc_varies_heading',
    unknown: 'item_detail.gmc_unknown_heading',
  }
  const resolvedHeadingKey = headingKey[gmc.status] ?? 'item_detail.gmc_caution_heading'

  return (
    <div
      className="mb-6 px-4 py-4 border border-neutral-400 rounded-lg"
      role="note"
      aria-labelledby="gmc-banner-heading"
    >
      <p id="gmc-banner-heading" className="text-sm font-semibold text-neutral-900 mb-2">
        {t(resolvedHeadingKey)}
      </p>
      {gmc.status_note && (
        <p className="text-sm text-neutral-700 mb-2">{gmc.status_note}</p>
      )}
      {gmc.markers_currently_available.length > 0 && (
        <p className="text-sm text-neutral-700 mb-2">
          Currently available: {gmc.markers_currently_available.join(', ')}
        </p>
      )}
      {gmc.status_date && (
        <p className="text-xs text-neutral-500 mb-2">
          {t('item_detail.gmc_verified', { date: gmc.status_date })}
        </p>
      )}
      {gmc.advocacy_links.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-neutral-500 mb-1">{t('item_detail.gmc_resources')}</p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {gmc.advocacy_links.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-neutral-500 mt-3">{t('item_detail.gmc_legal_note')}</p>
    </div>
  )
}

// Shown at some_guidance and walk_with_me when this item unlocks others on completion
function UnlocksHint({
  item,
  kb,
  presenceLevel,
}: {
  item: KBItem
  kb: { items: Record<string, KBItem> }
  presenceLevel: PresenceLevel
}) {
  const { t } = useTranslation()
  if (presenceLevel === 'just_the_path') return null

  const unlocked = Object.values(kb.items).filter((i) => i.requires.includes(item.slug))
  if (unlocked.length === 0) return null

  return (
    <section className="mb-6 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-lg">
      <p className="text-xs font-medium text-neutral-500 mb-2">
        {t('item_detail.unlocks_heading')}
      </p>
      <ul className="space-y-1">
        {unlocked.map((u) => (
          <li key={u.slug}>
            <Link
              to={`/item/${u.slug}`}
              className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
            >
              {u.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Immutable item notice
function ImmutableNotice({ item }: { item: KBItem }) {
  const { t } = useTranslation()
  return (
    <div className="mb-6 px-4 py-4 bg-neutral-50 border border-neutral-200 rounded-lg">
      <p className="text-sm font-semibold text-neutral-900 mb-1">
        {t('item_detail.immutable_heading')}
      </p>
      <p className="text-sm text-neutral-700 mb-2">
        {item.immutable_note ?? t('item_detail.immutable_why')}
      </p>
      {item.immutable_compassion_note && (
        <p className="text-sm text-neutral-600 mb-2">{item.immutable_compassion_note}</p>
      )}
      {item.workarounds.length > 0 && (
        <div>
          <p className="text-xs font-medium text-neutral-500 mt-3 mb-1">
            {t('item_detail.immutable_workarounds_heading')}
          </p>
          <ul className="space-y-1">
            {item.workarounds.map((w, i) => (
              <li key={i} className="text-sm text-neutral-700">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Process steps and access requirements
function ProcessSection({ item }: { item: KBItem }) {
  const { t } = useTranslation()
  const p = item.process!
  const req = p.access_requirements

  return (
    <div className="mb-8">
      <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-4">
        {t('item_detail.process_heading')}
      </h2>

      {p.summary && (
        <p className="text-sm text-neutral-700 mb-4 leading-relaxed">{p.summary}</p>
      )}

      {/* Documents required */}
      {p.documents_required.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-neutral-500 mb-1">
            {t('item_detail.documents_required')}
          </p>
          <ul className="space-y-0.5">
            {p.documents_required.map((doc) => (
              <li key={doc} className="text-sm text-neutral-700">
                {fmtSlug(doc)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps */}
      {p.steps.length > 0 && (
        <ol className="space-y-4 mb-4">
          {p.steps.map((step) => (
            <li key={step.step} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-100 text-neutral-600 text-xs font-medium flex items-center justify-center mt-0.5">
                {step.step}
              </span>
              <div className="flex-1">
                <p className="text-sm text-neutral-900">{step.description}</p>
                {step.modes.length > 0 && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {t('item_detail.modes_label')}{' '}
                    {step.modes.map((m) => MODE_LABEL[m] ?? m).join(', ')}
                  </p>
                )}
                {step.note && (
                  <p className="text-xs text-neutral-500 mt-0.5 italic">{step.note}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Access requirements */}
      <div className="mb-4 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-lg">
        <p className="text-xs font-medium text-neutral-500 mb-2">
          {t('item_detail.access_heading')}
        </p>
        <ul className="space-y-1">
          {req.internet === 'required' && (
            <li className="text-sm text-neutral-700">{t('item_detail.internet_required')}</li>
          )}
          {req.internet === 'optional' && (
            <li className="text-sm text-neutral-600">{t('item_detail.internet_optional')}</li>
          )}
          {req.printer === 'required' && (
            <li className="text-sm text-neutral-700">{t('item_detail.printer_required')}</li>
          )}
          {req.printer === 'optional' && (
            <li className="text-sm text-neutral-600">{t('item_detail.printer_optional')}</li>
          )}
          {req.phone && (
            <li className="text-sm text-neutral-700">{t('item_detail.phone_required')}</li>
          )}
          {req.copies && (
            <li className="text-sm text-neutral-700">{t('item_detail.copies_required')}</li>
          )}
          {req.notary && (
            <li className="text-sm text-neutral-700">{t('item_detail.notary_required')}</li>
          )}
          {req.travel_required && (
            <li className="text-sm text-neutral-700">
              {t('item_detail.travel_required')}
              {req.travel_note && (
                <span className="text-neutral-500"> — {req.travel_note}</span>
              )}
            </li>
          )}
        </ul>
      </div>

      {/* Time and cost */}
      {(p.estimated_time_days || p.cost) && (
        <div className="mb-4">
          <p className="text-xs font-medium text-neutral-500 mb-1">
            {t('item_detail.time_cost_heading')}
          </p>
          <div className="flex gap-4 text-sm text-neutral-700">
            {p.estimated_time_days && (
              <span>{t('item_detail.time_days', { days: p.estimated_time_days })}</span>
            )}
            {p.cost && (
              <span>{p.cost.toLowerCase() === 'free' ? t('item_detail.cost_free') : p.cost}</span>
            )}
          </div>
        </div>
      )}

      {/* Official links */}
      {(p.url_official || p.url_info) && (
        <div className="mb-4">
          <p className="text-xs font-medium text-neutral-500 mb-1">
            {t('item_detail.links_heading')}
          </p>
          <ul className="space-y-1">
            {p.url_official && (
              <li>
                <a
                  href={p.url_official}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
                >
                  {t('item_detail.official_link')}
                </a>
              </li>
            )}
            {p.url_info && (
              <li>
                <a
                  href={p.url_info}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
                >
                  {t('item_detail.info_link')}
                </a>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* KB process notes */}
      {p.notes && (
        <div className="mb-4 px-4 py-3 border-l-2 border-neutral-300">
          <p className="text-xs font-medium text-neutral-500 mb-1">{t('item_detail.kb_notes')}</p>
          <p className="text-sm text-neutral-700 leading-relaxed">{p.notes}</p>
        </div>
      )}
    </div>
  )
}

// Sub-tasks for a checklist entry — user-created steps, not KB process steps
function SubTasksSection({ slug, entry }: { slug: string; entry: ChecklistEntry }) {
  const { t } = useTranslation()
  const addSubTask = useAppStore((s) => s.addSubTask)
  const updateSubTask = useAppStore((s) => s.updateSubTask)
  const removeSubTask = useAppStore((s) => s.removeSubTask)
  const toggleSubTask = useAppStore((s) => s.toggleSubTask)

  const [addingLabel, setAddingLabel] = useState('')
  const [addingDueDate, setAddingDueDate] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editNote, setEditNote] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const subTasks: SubTask[] = entry.sub_tasks ?? []

  const handleAdd = () => {
    const label = addingLabel.trim()
    if (!label) return
    addSubTask(slug, {
      label,
      note: null,
      due_date: addingDueDate || null,
    })
    setAddingLabel('')
    setAddingDueDate('')
    setShowAdd(false)
  }

  const startEdit = (t: SubTask) => {
    setEditingId(t.id)
    setEditLabel(t.label)
    setEditDueDate(t.due_date ?? '')
    setEditNote(t.note ?? '')
  }

  const saveEdit = (id: string) => {
    updateSubTask(slug, id, {
      label: editLabel.trim() || editLabel,
      due_date: editDueDate || null,
      note: editNote.trim() || null,
    })
    setEditingId(null)
  }

  return (
    <section className="mb-8" aria-labelledby="subtasks-heading">
      <h2
        id="subtasks-heading"
        className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3"
      >
        {t('item_detail.subtasks_heading')}
      </h2>

      {subTasks.length > 0 && (
        <ul className="space-y-2 mb-3">
          {subTasks.map((task) => {
            const isPastDue = !task.done && task.due_date && task.due_date < today
            return (
              <li key={task.id}>
                {editingId === task.id ? (
                  <div className="px-3 py-3 border border-neutral-300 rounded-lg space-y-2">
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-neutral-500 block mb-0.5">
                          {t('item_detail.subtask_due_date')}
                        </label>
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder={t('item_detail.subtask_note_placeholder')}
                      className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(task.id)}
                        disabled={!editLabel.trim()}
                        className="px-3 py-1.5 bg-neutral-900 text-white text-xs rounded disabled:opacity-40"
                      >
                        {t('item_detail.subtask_save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900"
                      >
                        {t('item_detail.subtask_cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 px-3 py-2.5 border border-neutral-200 rounded-lg">
                    <button
                      type="button"
                      onClick={() => toggleSubTask(slug, task.id)}
                      className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        task.done
                          ? 'bg-neutral-900 border-neutral-900 text-white'
                          : 'border-neutral-400 hover:border-neutral-600'
                      }`}
                      aria-label={task.done ? t('item_detail.subtask_uncheck') : t('item_detail.subtask_check')}
                    >
                      {task.done && <span className="text-xs leading-none">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${task.done ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
                        {task.label}
                      </span>
                      {task.due_date && !task.done && (
                        <span className={`ml-2 text-xs ${isPastDue ? 'text-neutral-700 font-medium' : 'text-neutral-400'}`}>
                          {isPastDue ? t('item_detail.subtask_past_due', { date: task.due_date }) : task.due_date}
                        </span>
                      )}
                      {task.note && (
                        <p className="text-xs text-neutral-500 mt-0.5">{task.note}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(task)}
                        className="text-xs text-neutral-400 hover:text-neutral-700"
                      >
                        {t('item_detail.subtask_edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSubTask(slug, task.id)}
                        className="text-xs text-neutral-400 hover:text-neutral-700"
                      >
                        {t('item_detail.subtask_remove')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {showAdd ? (
        <div className="px-3 py-3 border border-neutral-200 rounded-lg space-y-2">
          <input
            type="text"
            value={addingLabel}
            onChange={(e) => setAddingLabel(e.target.value)}
            placeholder={t('item_detail.subtask_label_placeholder')}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <div>
            <label className="text-xs text-neutral-500 block mb-0.5">
              {t('item_detail.subtask_due_date')}
            </label>
            <input
              type="date"
              value={addingDueDate}
              onChange={(e) => setAddingDueDate(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!addingLabel.trim()}
              className="px-3 py-1.5 bg-neutral-900 text-white text-xs rounded disabled:opacity-40"
            >
              {t('item_detail.subtask_add')}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setAddingLabel(''); setAddingDueDate('') }}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900"
            >
              {t('item_detail.subtask_cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="text-sm text-neutral-500 hover:text-neutral-900 underline-offset-2 hover:underline"
        >
          + {t('item_detail.subtask_add_prompt')}
        </button>
      )}
    </section>
  )
}

// Surface recovery-path KB items when item is at_risk or revoked.
// User decides whether to add any of them to their checklist.
function RecoveryItemsSection({
  item,
  kb,
  onAddToChecklist,
}: {
  item: KBItem
  kb: { items: Record<string, KBItem> }
  onAddToChecklist: (slug: string) => void
}) {
  const { t } = useTranslation()
  const checklist = useAppStore((s) => s.userData.checklist)

  const recoveryItems = (item.recovery_items ?? [])
    .map((slug) => kb.items[slug])
    .filter(Boolean) as KBItem[]

  if (recoveryItems.length === 0) return null

  return (
    <section className="mb-6 px-4 py-4 bg-neutral-50 border border-neutral-200 rounded-lg">
      <p className="text-xs font-medium text-neutral-500 mb-2">
        {t('item_detail.recovery_heading')}
      </p>
      <p className="text-sm text-neutral-700 mb-3">{t('item_detail.recovery_intro')}</p>
      <ul className="space-y-2">
        {recoveryItems.map((r) => {
          const alreadyOnList = r.slug in checklist
          return (
            <li key={r.slug} className="flex items-center justify-between gap-3">
              <Link
                to={`/item/${r.slug}`}
                className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900 flex-1"
              >
                {r.label}
              </Link>
              {!alreadyOnList && (
                <button
                  type="button"
                  onClick={() => onAddToChecklist(r.slug)}
                  className="text-xs text-neutral-500 hover:text-neutral-900 flex-shrink-0 underline underline-offset-2"
                >
                  {t('item_detail.recovery_add')}
                </button>
              )}
              {alreadyOnList && (
                <span className="text-xs text-neutral-400 flex-shrink-0">
                  {t('item_detail.recovery_on_list')}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ItemDetail() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useTranslation()
  const kb = useAppStore((s) => s.kb)
  const kbLoading = useAppStore((s) => s.kbLoading)
  const kbError = useAppStore((s) => s.kbError)
  const userData = useAppStore((s) => s.userData)
  const setItemStatus = useAppStore((s) => s.setItemStatus)
  const setItemNotes = useAppStore((s) => s.setItemNotes)
  const addItemToChecklist = useAppStore((s) => s.addItemToChecklist)

  const item = slug && kb ? (kb.items[slug] ?? null) : null
  const entry = (slug ? userData.checklist[slug] : null) ?? DEFAULT_ENTRY
  const currentStatus = entry.status

  // Notes: local state for the textarea, save on blur
  const [localNotes, setLocalNotes] = useState(entry.notes)
  const lastSaved = useRef(entry.notes)

  useEffect(() => {
    // Sync if notes changed from outside (e.g. data import)
    if (entry.notes !== lastSaved.current) {
      setLocalNotes(entry.notes)
      lastSaved.current = entry.notes
    }
  }, [entry.notes])

  const handleNotesBlur = useCallback(() => {
    if (slug && localNotes !== lastSaved.current) {
      setItemNotes(slug, localNotes)
      lastSaved.current = localNotes
    }
  }, [slug, localNotes, setItemNotes])

  // ── Loading / not found ───────────────────────────────────────────────────

  if (kbLoading && !item) {
    return (
      <PageShell>
        <p className="text-sm text-neutral-500 py-8">{t('item_detail.loading')}</p>
      </PageShell>
    )
  }

  if (!item) {
    return (
      <PageShell>
        <div className="py-8">
          {kbError ? (
            <p className="text-sm text-neutral-700">{t('item_detail.kb_error')}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-neutral-900 mb-2">
                {t('item_detail.not_found')}
              </p>
              <p className="text-sm text-neutral-600">{t('item_detail.not_found_note')}</p>
            </>
          )}
        </div>
      </PageShell>
    )
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const profile = userData.profile
  const presenceLevel = getEffectiveLevel(profile, item.track)
  const gmc = item.gender_marker_change
  const showGmcBanner = gmc?.applies && gmc.status !== 'current'

  const presenceContent =
    presenceLevel === 'walk_with_me'
      ? (item.presence_level_content.walk_with_me ?? item.presence_level_content.some_guidance)
      : presenceLevel === 'some_guidance'
        ? item.presence_level_content.some_guidance
        : null

  const statusLog = entry.status_log ?? []

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageShell>
      {/* User item status alerts — above fold */}
      {currentStatus === 'at_risk' && <AtRiskAlert entry={entry} item={item} />}
      {currentStatus === 'revoked' && <RevokedAlert entry={entry} />}

      {/* Recovery path items — shown when at_risk or revoked */}
      {(currentStatus === 'at_risk' || currentStatus === 'revoked') && kb && (
        <RecoveryItemsSection
          item={item}
          kb={kb}
          onAddToChecklist={addItemToChecklist}
        />
      )}

      {/* KB-level danger/caution/unknown/unavailable banner */}
      {showGmcBanner && gmc && <GmcBanner gmc={gmc} />}

      {/* Immutable notice */}
      {item.immutable && <ImmutableNotice item={item} />}

      {/* Item header */}
      <div className="mb-6">
        <p className="text-xs text-neutral-400 mb-1 capitalize">
          {item.track}
          {item.subcategory && ` — ${item.subcategory}`}
        </p>
        <h1 className="text-xl font-semibold text-neutral-900">{item.label}</h1>
        <p className="mt-2 text-sm text-neutral-700 leading-relaxed">{item.description}</p>
        {item.last_verified && (
          <p className="mt-2 text-xs text-neutral-400">
            {t('item_detail.last_verified', { date: item.last_verified })}
            {item.verified_by === 'community' ? ' · Community verified' : ''}
          </p>
        )}
      </div>

      {/* Presence-level content */}
      {presenceContent && (
        <div className="mb-6 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-lg">
          <p className="text-xs font-medium text-neutral-500 mb-1">
            {t('item_detail.about_this_step')}
          </p>
          <p className="text-sm text-neutral-700 leading-relaxed">{presenceContent}</p>
        </div>
      )}

      {/* Discrimination notes */}
      {item.discrimination_notes && (
        <div className="mb-6 px-4 py-3 border-l-2 border-neutral-400">
          <p className="text-xs font-medium text-neutral-500 mb-1">
            {t('item_detail.rights_heading')}
          </p>
          <p className="text-sm text-neutral-700 leading-relaxed">{item.discrimination_notes}</p>
        </div>
      )}

      {/* Process */}
      {item.process && <ProcessSection item={item} />}

      {/* Status selector */}
      <section className="mb-8" aria-labelledby="status-heading">
        <h2
          id="status-heading"
          className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3"
        >
          {t('item_detail.status_heading')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => slug && setItemStatus(slug, status)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                status === currentStatus
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
              aria-pressed={status === currentStatus}
            >
              {t(`item.status.${status}`)}
            </button>
          ))}
        </div>
      </section>

      {/* Unlocks hint — shown at some_guidance and walk_with_me */}
      {kb && <UnlocksHint item={item} kb={kb} presenceLevel={presenceLevel} />}

      {/* Sub-tasks (user-created steps, not KB process steps) */}
      {slug && <SubTasksSection slug={slug} entry={entry} />}

      {/* Blockers */}
      {slug && <BlockersSection slug={slug} entry={entry} presenceLevel={presenceLevel} />}

      {/* Notes */}
      <section className="mb-8" aria-labelledby="notes-heading">
        <h2
          id="notes-heading"
          className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3"
        >
          {t('item_detail.notes_heading')}
        </h2>
        <textarea
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder={t('item.notes_placeholder')}
          rows={4}
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-600 resize-none"
          aria-label={t('item_detail.notes_heading')}
        />
        <p className="text-xs text-neutral-400 mt-1">{t('item_detail.notes_private_note')}</p>
      </section>

      {/* Status history (only visible once multiple transitions have occurred) */}
      {statusLog.length > 1 && (
        <section className="mb-8" aria-labelledby="history-heading">
          <h2
            id="history-heading"
            className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3"
          >
            {t('item_detail.history_heading')}
          </h2>
          <ol className="space-y-1">
            {statusLog.map((log, i) => (
              <li key={i} className="text-sm text-neutral-600">
                <span className="text-neutral-900">{t(`item.status.${log.status}`)}</span>
                {' '}
                {t('item_detail.history_on', { date: fmtDate(log.at) })}
                {log.note && <span className="text-neutral-500"> — {log.note}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Report issue */}
      <div className="pt-4 border-t border-neutral-200">
        <Link
          to={`/contribute/${slug}`}
          className="text-sm text-neutral-500 hover:text-neutral-900 underline-offset-2 hover:underline"
        >
          {t('item_detail.report')}
        </Link>
      </div>
    </PageShell>
  )
}
