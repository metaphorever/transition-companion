import { useMemo, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store'
import type {
  Blocker,
  BlockerOutOfControlKind,
  BlockerResolutionMode,
  BlockerType,
  ChecklistEntry,
  ItemStatus,
  KBCache,
  KBCondition,
  PresenceLevel,
  UserData,
} from '../../types'
import { isActiveStoredBlocker } from '../../utils/ordering'
import { dueDateLabel, getEffectiveDueDate, localDateString } from '../../utils/recurring'

// Only user-defined blocker types are surfaced. `document` blockers are
// graph-derived and never stored — see CLAUDE.md.
const USER_BLOCKER_TYPES: BlockerType[] = [
  'legal',
  'access',
  'safety',
  'relationship',
  'readiness',
  'waiting',
  'custom',
]

const RESOLUTION_MODES: BlockerResolutionMode[] = ['resolvable', 'out_of_control']
const OUT_OF_CONTROL_KINDS: BlockerOutOfControlKind[] = ['policy', 'personal_circumstance']

// Statuses a resolution task must hit to surface the confirm-resolve prompt.
const COMPLETE_STATUSES: ItemStatus[] = ['complete', 'at_risk']

interface BlockersSectionProps {
  slug: string
  entry: ChecklistEntry
  presenceLevel: PresenceLevel
  /** Category/track of the parent item — used to seed convert-to-task defaults. */
  parentCategory?: string
  parentTrack?: string
}

interface BlockerDraft {
  type: BlockerType
  description: string
  resolution_mode: BlockerResolutionMode
  out_of_control_kind: BlockerOutOfControlKind
  kb_condition_ref: string
  suppress_workaround: boolean
}

function emptyDraft(): BlockerDraft {
  return {
    type: 'custom',
    description: '',
    resolution_mode: 'resolvable',
    out_of_control_kind: 'personal_circumstance',
    kb_condition_ref: '',
    suppress_workaround: false,
  }
}

function draftFromBlocker(b: Blocker): BlockerDraft {
  return {
    type: b.type === 'document' ? 'custom' : b.type,
    description: b.description ?? '',
    resolution_mode: b.resolution_mode ?? 'resolvable',
    out_of_control_kind: b.out_of_control_kind ?? 'personal_circumstance',
    kb_condition_ref: b.kb_condition_ref ?? '',
    suppress_workaround: b.suppress_workaround ?? false,
  }
}

function buildPayload(draft: BlockerDraft): Omit<Blocker, 'id' | 'status' | 'status_date'> {
  const payload: Omit<Blocker, 'id' | 'status' | 'status_date'> = {
    type: draft.type,
    resolution_mode: draft.resolution_mode,
    description: draft.description.trim(),
  }
  if (draft.resolution_mode === 'out_of_control') {
    payload.out_of_control_kind = draft.out_of_control_kind
    if (draft.out_of_control_kind === 'policy' && draft.kb_condition_ref) {
      payload.kb_condition_ref = draft.kb_condition_ref
    }
  }
  if (draft.suppress_workaround) {
    payload.suppress_workaround = true
  }
  return payload
}

// ── Resolution-task ref resolution ────────────────────────────────────────────

interface ResolutionTaskRef {
  id: string
  label: string
  status: ItemStatus
  exists: boolean
}

function resolveTaskRef(
  id: string,
  kb: KBCache | null,
  userData: UserData
): ResolutionTaskRef {
  const entry = userData.checklist[id]
  const kbItem = kb?.items[id]
  if (kbItem) {
    return { id, label: kbItem.label, status: entry?.status ?? 'not_started', exists: true }
  }
  const custom = userData.custom_items.find((c) => c.id === id)
  if (custom) {
    return { id, label: custom.label, status: entry?.status ?? custom.status, exists: true }
  }
  return { id, label: id, status: 'not_started', exists: false }
}

// ── Reverse lookup: which parents reference this slug as a resolution task ───

interface ParentRef {
  slug: string
  label: string
  blockerId: string
}

function findParentsReferencingTask(
  slug: string,
  kb: KBCache | null,
  userData: UserData
): ParentRef[] {
  const parents: ParentRef[] = []
  for (const [parentSlug, parentEntry] of Object.entries(userData.checklist)) {
    if (parentSlug === slug) continue
    for (const b of parentEntry.blockers) {
      if (!isActiveStoredBlocker(b)) continue
      if (!(b.resolution_task_ids ?? []).includes(slug)) continue
      const kbItem = kb?.items[parentSlug]
      const customItem = userData.custom_items.find((c) => c.id === parentSlug)
      const label = kbItem?.label ?? customItem?.label ?? parentSlug
      parents.push({ slug: parentSlug, label, blockerId: b.id })
    }
  }
  return parents
}

// ── Trail helpers (for breadcrumb-aware drill-in links) ──────────────────────

function appendTrail(currentTrail: string | null, parentSlug: string): string {
  const parts = currentTrail ? currentTrail.split(',').filter(Boolean) : []
  parts.push(parentSlug)
  return parts.join(',')
}

function buildDrillInHref(targetId: string, parentSlug: string, currentTrail: string | null): string {
  const trail = appendTrail(currentTrail, parentSlug)
  return `/item/${targetId}?trail=${encodeURIComponent(trail)}`
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function ResolutionTaskRow({
  task,
  parentSlug,
  currentTrail,
}: {
  task: ResolutionTaskRef
  parentSlug: string
  currentTrail: string | null
}) {
  const { t } = useTranslation()
  const isComplete = COMPLETE_STATUSES.includes(task.status)
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded">
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${isComplete ? 'text-neutral-500 line-through' : 'text-neutral-900'}`}>
          {task.label}
        </span>
        <span className="text-xs text-neutral-500 ml-2">
          {t(`item.status.${task.status}`)}
        </span>
      </div>
      {task.exists && (
        <Link
          to={buildDrillInHref(task.id, parentSlug, currentTrail)}
          className="text-xs text-neutral-700 underline underline-offset-2 hover:text-neutral-900 flex-shrink-0"
        >
          {t('blockers.resolution_task_drill_in')}
        </Link>
      )}
    </li>
  )
}

function KBConditionPanel({
  condition,
  blockerStatusDate,
  onRevisit,
  onAcknowledge,
}: {
  condition: KBCondition
  blockerStatusDate: string
  onRevisit: () => void
  onAcknowledge: () => void
}) {
  const { t } = useTranslation()
  const policyChanged = condition.status_date > blockerStatusDate
  const firstReference = condition.references[0]
  return (
    <div className="mt-2 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1">
        {t('blockers.policy_situation_heading')}
      </p>
      <p className="text-sm text-neutral-800 leading-relaxed">{condition.name}</p>
      {condition.status_summary && (
        <p className="text-xs text-neutral-600 leading-relaxed mt-1">{condition.status_summary}</p>
      )}
      <p className="text-xs text-neutral-500 leading-relaxed mt-1">
        {t('blockers.policy_situation_status_line', {
          status: t(`blockers.condition_status.${condition.current_status}`),
          date: condition.status_date,
        })}
      </p>
      {firstReference && (
        <p className="text-xs mt-1">
          <a
            href={firstReference.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
          >
            {firstReference.label}
          </a>
        </p>
      )}
      {policyChanged && (
        <div className="mt-2 px-3 py-2 border border-neutral-400 rounded">
          <p className="text-sm font-medium text-neutral-900 mb-1">
            {t('blockers.policy_changed_heading')}
          </p>
          <p className="text-xs text-neutral-600 mb-2">{t('blockers.policy_changed_intro')}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRevisit}
              className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
            >
              {t('blockers.policy_changed_revisit')}
            </button>
            <button
              type="button"
              onClick={onAcknowledge}
              className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
            >
              {t('blockers.policy_changed_acknowledge')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const REMINDER_INTERVAL_OPTIONS = [30, 90, 180, 365] as const

function PersonalCircumstancePanel({
  blocker,
  userData,
  onAttachReminder,
  onLogReminder,
  onDetachReminder,
}: {
  blocker: Blocker
  userData: UserData
  onAttachReminder: (intervalDays: number) => void
  onLogReminder: () => void
  onDetachReminder: () => void
}) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [interval, setInterval] = useState<number>(90)

  const reminder = useMemo(() => {
    if (!blocker.reminder_recurring_id) return null
    return userData.recurring_items.find((r) => r.id === blocker.reminder_recurring_id) ?? null
  }, [blocker.reminder_recurring_id, userData.recurring_items])

  const today = localDateString()
  const due = reminder ? getEffectiveDueDate(reminder) : null
  const isOverdueOrToday = due !== null && due <= today

  return (
    <div className="mt-2 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded">
      <p className="text-xs text-neutral-600 leading-relaxed">
        {t('blockers.personal_circumstance_note')}
      </p>

      {!reminder && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-2 text-xs text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
        >
          {t('blockers.reminder_attach')}
        </button>
      )}

      {!reminder && showForm && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-neutral-500 leading-relaxed">
            {t('blockers.reminder_form_intro')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_INTERVAL_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setInterval(days)}
                className={`px-2 py-1 text-xs rounded border ${
                  interval === days
                    ? 'border-neutral-700 bg-neutral-100 text-neutral-900'
                    : 'border-neutral-300 text-neutral-600 hover:border-neutral-500'
                }`}
              >
                {t(`blockers.reminder_interval.${days}`)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onAttachReminder(interval)
                setShowForm(false)
              }}
              className="px-3 py-1.5 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-800"
            >
              {t('blockers.reminder_save')}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900"
            >
              {t('blockers.cancel')}
            </button>
          </div>
        </div>
      )}

      {reminder && (
        <div className="mt-2">
          <p className="text-xs text-neutral-700 leading-relaxed">
            {due
              ? t('blockers.reminder_due_label', {
                  when: dueDateLabel(due, today),
                  date: due,
                })
              : t('blockers.reminder_open')}
          </p>
          <div className="flex flex-wrap gap-3 mt-1.5">
            {isOverdueOrToday && (
              <button
                type="button"
                onClick={onLogReminder}
                className="text-xs text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
              >
                {t('blockers.reminder_log')}
              </button>
            )}
            <Link
              to="/recurring"
              className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
            >
              {t('blockers.reminder_open_in_recurring')}
            </Link>
            <button
              type="button"
              onClick={onDetachReminder}
              className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
            >
              {t('blockers.reminder_remove')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfirmResolvePrompt({
  onConfirm,
}: {
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="mt-2 px-3 py-2 border border-neutral-400 rounded">
      <p className="text-sm font-medium text-neutral-900 mb-1">
        {t('blockers.confirm_resolve_heading')}
      </p>
      <p className="text-xs text-neutral-600 mb-2 leading-relaxed">
        {t('blockers.confirm_resolve_intro')}
      </p>
      <button
        type="button"
        onClick={onConfirm}
        className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded hover:bg-neutral-800"
      >
        {t('blockers.confirm_resolve_button')}
      </button>
    </div>
  )
}

function ConvertToTaskForm({
  defaultLabel,
  defaultCategory,
  defaultTrack,
  onSubmit,
  onCancel,
}: {
  defaultLabel: string
  defaultCategory: string
  defaultTrack: string
  onSubmit: (init: { label: string; category: string; track: string; description?: string }) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [label, setLabel] = useState(defaultLabel)
  const [description, setDescription] = useState('')
  const canSubmit = label.trim().length > 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSubmit) return
        onSubmit({
          label: label.trim(),
          category: defaultCategory,
          track: defaultTrack,
          description: description.trim() || undefined,
        })
      }}
      className="mt-2 px-3 py-3 border border-neutral-300 rounded space-y-2"
    >
      <p className="text-xs text-neutral-500 leading-relaxed">{t('blockers.convert_to_task_intro')}</p>
      <div>
        <label htmlFor="convert-label" className="block text-xs font-medium text-neutral-500 mb-1">
          {t('blockers.convert_to_task_label')}
        </label>
        <input
          id="convert-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('blockers.convert_to_task_label_placeholder')}
          className="w-full px-3 py-2 text-base border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
          required
        />
      </div>
      <div>
        <label htmlFor="convert-description" className="block text-xs font-medium text-neutral-500 mb-1">
          {t('blockers.convert_to_task_description')}
        </label>
        <textarea
          id="convert-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-base border border-neutral-300 rounded focus:outline-none focus:border-neutral-600 resize-none"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed"
        >
          {t('blockers.convert_to_task_save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900"
        >
          {t('blockers.cancel')}
        </button>
      </div>
    </form>
  )
}

function RemoveConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="mt-2 px-3 py-3 border border-neutral-400 rounded">
      <p className="text-sm text-neutral-900 mb-1">{t('blockers.remove_confirm_bad_data')}</p>
      <p className="text-xs text-neutral-600 mb-3 leading-relaxed">
        {t('blockers.remove_confirm_situation_changed')}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded hover:bg-neutral-800"
        >
          {t('blockers.remove_anyway')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900"
        >
          {t('blockers.cancel')}
        </button>
      </div>
    </div>
  )
}

// ── Blocker card ─────────────────────────────────────────────────────────────

function BlockerCard({
  blocker,
  parentSlug,
  parentCategory,
  parentTrack,
  currentTrail,
  kb,
  userData,
  onEdit,
  onRemove,
  onResolve,
  onDismiss,
  onReactivate,
  onConvertToTask,
  onAcknowledgePolicyChange,
  onAttachReminder,
  onLogReminder,
  onDetachReminder,
}: {
  blocker: Blocker
  parentSlug: string
  parentCategory: string
  parentTrack: string
  currentTrail: string | null
  kb: KBCache | null
  userData: UserData
  onEdit: () => void
  onRemove: () => void
  onResolve: () => void
  onDismiss: () => void
  onReactivate: () => void
  onConvertToTask: (init: {
    label: string
    category: string
    track: string
    description?: string
  }) => void
  onAcknowledgePolicyChange: () => void
  onAttachReminder: (intervalDays: number) => void
  onLogReminder: () => void
  onDetachReminder: () => void
}) {
  const { t } = useTranslation()
  const [showConvert, setShowConvert] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  const isActive = (blocker.status ?? 'active') === 'active'
  const isResolved = blocker.status === 'resolved'

  const resolutionRefs = useMemo<ResolutionTaskRef[]>(
    () =>
      (blocker.resolution_task_ids ?? []).map((id) => resolveTaskRef(id, kb, userData)),
    [blocker.resolution_task_ids, kb, userData]
  )
  const anyComplete = resolutionRefs.some((r) => COMPLETE_STATUSES.includes(r.status))

  const condition: KBCondition | null = useMemo(() => {
    if (!blocker.kb_condition_ref) return null
    return kb?.conditions?.[blocker.kb_condition_ref] ?? null
  }, [blocker.kb_condition_ref, kb])

  return (
    <div
      className={`px-4 py-3 border rounded-lg ${
        isActive ? 'border-neutral-300' : 'border-neutral-200 opacity-75'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              {t(`blockers.type.${blocker.type === 'document' ? 'custom' : blocker.type}`)}
            </span>
            <span className="text-xs text-neutral-400">
              ·{' '}
              {blocker.resolution_mode === 'resolvable'
                ? t('blockers.resolution_mode_resolvable')
                : blocker.out_of_control_kind === 'policy'
                  ? t('blockers.out_of_control_policy')
                  : t('blockers.out_of_control_personal_circumstance')}
            </span>
            <span className="text-xs text-neutral-400">
              ·{' '}
              {isActive
                ? t('blockers.active_status_label', { date: blocker.status_date })
                : isResolved
                  ? t('blockers.resolved_status_label', { date: blocker.status_date })
                  : t('blockers.dismissed_status_label', { date: blocker.status_date })}
            </span>
          </div>
          {blocker.description && (
            <p className="text-sm text-neutral-900 leading-relaxed">{blocker.description}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {isActive && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
              >
                {t('blockers.edit')}
              </button>
              <button
                type="button"
                onClick={onResolve}
                className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
              >
                {t('blockers.resolve')}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
              >
                {t('blockers.dismiss')}
              </button>
            </>
          )}
          {!isActive && (
            <button
              type="button"
              onClick={onReactivate}
              className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
            >
              {t('blockers.reactivate')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowRemoveConfirm(true)}
            className="text-xs text-neutral-400 hover:text-neutral-700 underline underline-offset-2"
          >
            {t('blockers.remove')}
          </button>
        </div>
      </div>

      {/* Resolution tasks for resolvable blockers */}
      {isActive && blocker.resolution_mode === 'resolvable' && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">
            {t('blockers.resolution_tasks_heading')}
          </p>
          {resolutionRefs.length > 0 ? (
            <ul className="space-y-1.5 mb-2">
              {resolutionRefs.map((task) => (
                <ResolutionTaskRow
                  key={task.id}
                  task={task}
                  parentSlug={parentSlug}
                  currentTrail={currentTrail}
                />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-neutral-500 mb-2 leading-relaxed">
              {t('blockers.resolution_tasks_empty')}
            </p>
          )}
          {!showConvert ? (
            <button
              type="button"
              onClick={() => setShowConvert(true)}
              className="text-xs text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
            >
              {t('blockers.convert_to_task')}
            </button>
          ) : (
            <ConvertToTaskForm
              defaultLabel={blocker.description ?? ''}
              defaultCategory={parentCategory}
              defaultTrack={parentTrack}
              onSubmit={(init) => {
                onConvertToTask(init)
                setShowConvert(false)
              }}
              onCancel={() => setShowConvert(false)}
            />
          )}
        </div>
      )}

      {/* KB condition panel for policy blockers */}
      {isActive &&
        blocker.resolution_mode === 'out_of_control' &&
        blocker.out_of_control_kind === 'policy' &&
        condition && (
          <KBConditionPanel
            condition={condition}
            blockerStatusDate={blocker.status_date}
            onRevisit={onEdit}
            onAcknowledge={onAcknowledgePolicyChange}
          />
        )}

      {/* Personal circumstance panel — text + optional re-check reminder */}
      {isActive &&
        blocker.resolution_mode === 'out_of_control' &&
        blocker.out_of_control_kind === 'personal_circumstance' && (
          <PersonalCircumstancePanel
            blocker={blocker}
            userData={userData}
            onAttachReminder={onAttachReminder}
            onLogReminder={onLogReminder}
            onDetachReminder={onDetachReminder}
          />
        )}

      {/* Confirm-resolve prompt — a linked resolution task is complete */}
      {isActive &&
        blocker.resolution_mode === 'resolvable' &&
        anyComplete && <ConfirmResolvePrompt onConfirm={onResolve} />}

      {showRemoveConfirm && (
        <RemoveConfirm
          onConfirm={() => {
            setShowRemoveConfirm(false)
            onRemove()
          }}
          onCancel={() => setShowRemoveConfirm(false)}
        />
      )}
    </div>
  )
}

// ── Form ─────────────────────────────────────────────────────────────────────

function BlockerForm({
  initial,
  conditions,
  onSubmit,
  onCancel,
}: {
  initial?: Blocker
  conditions: Record<string, KBCondition>
  onSubmit: (payload: Omit<Blocker, 'id' | 'status' | 'status_date'>) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<BlockerDraft>(
    initial ? draftFromBlocker(initial) : emptyDraft()
  )
  const conditionsList = Object.values(conditions).sort((a, b) => a.name.localeCompare(b.name))

  const canSubmit = draft.description.trim().length > 0

  function update<K extends keyof BlockerDraft>(key: K, value: BlockerDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSubmit) return
        onSubmit(buildPayload(draft))
      }}
      className="px-4 py-4 border border-neutral-300 rounded-lg space-y-4"
    >
      <div>
        <label htmlFor="blocker-description" className="block text-xs font-medium text-neutral-500 mb-1">
          {t('blockers.field_description')}
        </label>
        <input
          id="blocker-description"
          type="text"
          value={draft.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder={t('blockers.field_description_placeholder')}
          className="w-full px-3 py-2 text-base border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
          required
        />
      </div>

      <div>
        <label htmlFor="blocker-type" className="block text-xs font-medium text-neutral-500 mb-1">
          {t('blockers.field_type')}
        </label>
        <select
          id="blocker-type"
          value={draft.type}
          onChange={(e) => update('type', e.target.value as BlockerType)}
          className="w-full px-3 py-2 text-base border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
        >
          {USER_BLOCKER_TYPES.map((t_) => (
            <option key={t_} value={t_}>
              {t(`blockers.type.${t_}`)}
            </option>
          ))}
        </select>
        <p className="text-xs text-neutral-500 mt-1">{t(`blockers.type_hint.${draft.type}`)}</p>
      </div>

      <fieldset>
        <legend className="block text-xs font-medium text-neutral-500 mb-2">
          {t('blockers.field_resolution_mode')}
        </legend>
        <div className="space-y-2">
          {RESOLUTION_MODES.map((mode) => (
            <label key={mode} className="flex items-start gap-2 text-sm text-neutral-700">
              <input
                type="radio"
                name="resolution-mode"
                value={mode}
                checked={draft.resolution_mode === mode}
                onChange={() => update('resolution_mode', mode)}
                className="mt-0.5"
              />
              <span>
                {mode === 'resolvable'
                  ? t('blockers.resolution_mode_resolvable')
                  : t('blockers.resolution_mode_out_of_control')}
                <span className="block text-xs text-neutral-500">
                  {mode === 'resolvable'
                    ? t('blockers.resolution_mode_resolvable_hint')
                    : t('blockers.resolution_mode_out_of_control_hint')}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {draft.resolution_mode === 'out_of_control' && (
        <fieldset>
          <legend className="block text-xs font-medium text-neutral-500 mb-2">
            {t('blockers.field_out_of_control_kind')}
          </legend>
          <div className="space-y-2">
            {OUT_OF_CONTROL_KINDS.map((kind) => (
              <label key={kind} className="flex items-start gap-2 text-sm text-neutral-700">
                <input
                  type="radio"
                  name="out-of-control-kind"
                  value={kind}
                  checked={draft.out_of_control_kind === kind}
                  onChange={() => update('out_of_control_kind', kind)}
                  className="mt-0.5"
                />
                <span>
                  {kind === 'policy'
                    ? t('blockers.out_of_control_policy')
                    : t('blockers.out_of_control_personal_circumstance')}
                  <span className="block text-xs text-neutral-500">
                    {kind === 'policy'
                      ? t('blockers.out_of_control_policy_hint')
                      : t('blockers.out_of_control_personal_circumstance_hint')}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {draft.resolution_mode === 'out_of_control' &&
        draft.out_of_control_kind === 'policy' && (
          <div>
            <label
              htmlFor="blocker-kb-condition"
              className="block text-xs font-medium text-neutral-500 mb-1"
            >
              {t('blockers.field_kb_condition')}
            </label>
            <select
              id="blocker-kb-condition"
              value={draft.kb_condition_ref}
              onChange={(e) => update('kb_condition_ref', e.target.value)}
              className="w-full px-3 py-2 text-base border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
            >
              <option value="">{t('blockers.field_kb_condition_none')}</option>
              {conditionsList.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

      <label className="flex items-start gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={draft.suppress_workaround}
          onChange={(e) => update('suppress_workaround', e.target.checked)}
          className="mt-0.5"
        />
        <span>
          {t('blockers.field_suppress_workaround')}
          <span className="block text-xs text-neutral-500">
            {t('blockers.field_suppress_workaround_hint')}
          </span>
        </span>
      </label>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-4 py-1.5 text-sm bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed"
        >
          {initial ? t('blockers.save_changes') : t('blockers.save_new')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-sm text-neutral-600 hover:text-neutral-900"
        >
          {t('blockers.cancel')}
        </button>
      </div>
    </form>
  )
}

// ── Reverse lookup header ────────────────────────────────────────────────────

function ReverseLookupHeader({
  parents,
  currentTrail,
}: {
  parents: ParentRef[]
  currentTrail: string | null
}) {
  const { t } = useTranslation()
  if (parents.length === 0) return null

  // Pop the last trail entry — that's the parent the user drilled in from.
  // The "back" link points there; if there are multiple parents and no trail,
  // we still surface them all so the user can navigate to any.
  return (
    <div className="mb-6 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-lg">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">
        {t('blockers.reverse_lookup_heading')}
      </p>
      <ul className="space-y-1">
        {parents.map((p) => {
          // Build the back-href: pop the last trail entry if it matches the parent.
          const trailParts = currentTrail ? currentTrail.split(',').filter(Boolean) : []
          let backHref = `/item/${p.slug}`
          if (trailParts.length > 0 && trailParts[trailParts.length - 1] === p.slug) {
            const remaining = trailParts.slice(0, -1).join(',')
            if (remaining) backHref += `?trail=${encodeURIComponent(remaining)}`
          }
          return (
            <li key={`${p.slug}-${p.blockerId}`}>
              <Link
                to={backHref}
                className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
              >
                {p.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Section ──────────────────────────────────────────────────────────────────

export default function BlockersSection({
  slug,
  entry,
  presenceLevel,
  parentCategory = 'personal',
  parentTrack = 'personal',
}: BlockersSectionProps) {
  // presenceLevel is reserved for future workaround-surfacing logic — see
  // CLAUDE.md's notes on workaround visibility under guidance/walk-with-me.
  void presenceLevel
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const addBlocker = useAppStore((s) => s.addBlocker)
  const updateBlocker = useAppStore((s) => s.updateBlocker)
  const removeBlocker = useAppStore((s) => s.removeBlocker)
  const resolveBlocker = useAppStore((s) => s.resolveBlocker)
  const dismissBlocker = useAppStore((s) => s.dismissBlocker)
  const reactivateBlocker = useAppStore((s) => s.reactivateBlocker)
  const convertBlockerToTask = useAppStore((s) => s.convertBlockerToTask)
  const addRecurringItem = useAppStore((s) => s.addRecurringItem)
  const removeRecurringItem = useAppStore((s) => s.removeRecurringItem)
  const logRecurringItem = useAppStore((s) => s.logRecurringItem)
  const kb = useAppStore((s) => s.kb)
  const userData = useAppStore((s) => s.userData)

  // Build a label for a re-check recurring item from the parent + blocker.
  // Pulled into a helper because both branches (drill into onAttachReminder
  // from the active and the show-resolved card list) call it.
  function buildReminderLabel(blocker: Blocker): string {
    const parentLabel =
      kb?.items[slug]?.label ??
      userData.custom_items.find((c) => c.id === slug)?.label ??
      slug
    return t('blockers.recurring_label_template', {
      parent: parentLabel,
      blocker: blocker.description ?? t('blockers.recurring_label_fallback'),
    })
  }

  function handleAttachReminder(blocker: Blocker, intervalDays: number) {
    const newId = addRecurringItem({
      label: buildReminderLabel(blocker),
      mode: 'fixed',
      interval_days: intervalDays,
      next_date: null,
      last_logged_at: null,
      start_date: localDateString(),
      track: parentTrack,
      notes: '',
    })
    updateBlocker(slug, blocker.id, { reminder_recurring_id: newId })
  }

  function handleDetachReminder(blocker: Blocker) {
    if (blocker.reminder_recurring_id) {
      removeRecurringItem(blocker.reminder_recurring_id)
    }
    updateBlocker(slug, blocker.id, { reminder_recurring_id: undefined })
  }

  function handleLogReminder(blocker: Blocker) {
    if (blocker.reminder_recurring_id) {
      logRecurringItem(blocker.reminder_recurring_id)
    }
  }

  function handleAcknowledgePolicyChange(blocker: Blocker) {
    updateBlocker(slug, blocker.id, { status_date: localDateString() })
  }

  // Read ?trail= from the URL so drill-in links can stack the breadcrumb.
  const currentTrail = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('trail')
  }, [location.search])

  type Mode =
    | { kind: 'idle' }
    | { kind: 'adding' }
    | { kind: 'editing'; id: string }
    | { kind: 'collapsed' }
  const initialMode: Mode =
    entry.blockers.filter((b) => b.type !== 'document').length === 0
      ? { kind: 'collapsed' }
      : { kind: 'idle' }
  const [mode, setMode] = useState<Mode>(initialMode)
  const [showResolved, setShowResolved] = useState(false)

  // Hide stored document blockers — those are graph-derived (see CLAUDE.md).
  const allBlockers = entry.blockers.filter((b) => b.type !== 'document')
  const activeBlockers = allBlockers.filter((b) => (b.status ?? 'active') === 'active')
  const inactiveBlockers = allBlockers.filter((b) => (b.status ?? 'active') !== 'active')
  const editing =
    mode.kind === 'editing' ? allBlockers.find((b) => b.id === mode.id) : undefined

  const parents = useMemo(
    () => findParentsReferencingTask(slug, kb, userData),
    [slug, kb, userData]
  )

  return (
    <section className="mb-8" aria-labelledby="blockers-heading">
      <ReverseLookupHeader parents={parents} currentTrail={currentTrail} />

      <div className="flex items-center justify-between mb-2">
        <h2
          id="blockers-heading"
          className="text-xs font-medium uppercase tracking-wider text-neutral-500"
        >
          {t('blockers.heading')}
        </h2>
        {allBlockers.length === 0 && mode.kind === 'collapsed' && (
          <button
            type="button"
            onClick={() => setMode({ kind: 'idle' })}
            className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
          >
            {t('blockers.empty_collapsed')}
          </button>
        )}
      </div>

      {allBlockers.length === 0 && mode.kind !== 'collapsed' && mode.kind !== 'adding' && (
        <p className="text-sm text-neutral-500 mb-3 leading-relaxed">
          {t('blockers.empty_expanded')}
        </p>
      )}

      {allBlockers.length > 0 && (
        <p className="text-xs text-neutral-500 mb-3 leading-relaxed">{t('blockers.intro')}</p>
      )}

      {activeBlockers.length > 0 && (
        <ul className="space-y-2 mb-3">
          {activeBlockers.map((b) => (
            <li key={b.id}>
              {mode.kind === 'editing' && mode.id === b.id ? null : (
                <BlockerCard
                  blocker={b}
                  parentSlug={slug}
                  parentCategory={parentCategory}
                  parentTrack={parentTrack}
                  currentTrail={currentTrail}
                  kb={kb}
                  userData={userData}
                  onEdit={() => setMode({ kind: 'editing', id: b.id })}
                  onRemove={() => {
                    removeBlocker(slug, b.id)
                    if (mode.kind === 'editing' && mode.id === b.id) setMode({ kind: 'idle' })
                  }}
                  onResolve={() => resolveBlocker(slug, b.id)}
                  onDismiss={() => dismissBlocker(slug, b.id)}
                  onReactivate={() => reactivateBlocker(slug, b.id)}
                  onConvertToTask={(init) => {
                    const newId = convertBlockerToTask(slug, b.id, init)
                    // Drill into the new task immediately, with breadcrumb back here.
                    navigate(buildDrillInHref(newId, slug, currentTrail))
                  }}
                  onAcknowledgePolicyChange={() => handleAcknowledgePolicyChange(b)}
                  onAttachReminder={(days) => handleAttachReminder(b, days)}
                  onLogReminder={() => handleLogReminder(b)}
                  onDetachReminder={() => handleDetachReminder(b)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {mode.kind === 'editing' && editing && kb && (
        <div className="mb-3">
          <BlockerForm
            initial={editing}
            conditions={kb.conditions ?? {}}
            onSubmit={(payload) => {
              updateBlocker(slug, editing.id, payload)
              setMode({ kind: 'idle' })
            }}
            onCancel={() => setMode({ kind: 'idle' })}
          />
        </div>
      )}

      {mode.kind === 'adding' && kb && (
        <div className="mb-3">
          <BlockerForm
            conditions={kb.conditions ?? {}}
            onSubmit={(payload) => {
              addBlocker(slug, payload)
              setMode({ kind: 'idle' })
            }}
            onCancel={() => setMode({ kind: 'idle' })}
          />
        </div>
      )}

      {mode.kind !== 'adding' && mode.kind !== 'editing' && mode.kind !== 'collapsed' && (
        <button
          type="button"
          onClick={() => setMode({ kind: 'adding' })}
          className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
        >
          {allBlockers.length === 0 ? t('blockers.add_first') : t('blockers.add_another')}
        </button>
      )}

      {/* Resolved / dismissed history */}
      {inactiveBlockers.length > 0 && (
        <div className="mt-4 pt-3 border-t border-neutral-200">
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="text-xs text-neutral-500 hover:text-neutral-900 underline-offset-2 hover:underline"
          >
            {showResolved ? t('blockers.hide_resolved') : t('blockers.show_resolved')}
            <span className="ml-1 font-normal text-neutral-400">({inactiveBlockers.length})</span>
          </button>

          {showResolved && (
            <ul className="space-y-2 mt-3">
              {inactiveBlockers.map((b) => (
                <li key={b.id}>
                  <BlockerCard
                    blocker={b}
                    parentSlug={slug}
                    parentCategory={parentCategory}
                    parentTrack={parentTrack}
                    currentTrail={currentTrail}
                    kb={kb}
                    userData={userData}
                    onEdit={() => setMode({ kind: 'editing', id: b.id })}
                    onRemove={() => removeBlocker(slug, b.id)}
                    onResolve={() => resolveBlocker(slug, b.id)}
                    onDismiss={() => dismissBlocker(slug, b.id)}
                    onReactivate={() => reactivateBlocker(slug, b.id)}
                    onConvertToTask={(init) => {
                      const newId = convertBlockerToTask(slug, b.id, init)
                      navigate(buildDrillInHref(newId, slug, currentTrail))
                    }}
                    onAcknowledgePolicyChange={() => handleAcknowledgePolicyChange(b)}
                    onAttachReminder={(days) => handleAttachReminder(b, days)}
                    onLogReminder={() => handleLogReminder(b)}
                    onDetachReminder={() => handleDetachReminder(b)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
