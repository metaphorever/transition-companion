import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store'
import type {
  Blocker,
  BlockerResolvable,
  BlockerSeverity,
  BlockerType,
  ChecklistEntry,
  PresenceLevel,
} from '../../types'

// Only user-defined blocker types are surfaced. `document` blockers are
// derived from the dependency graph (see CLAUDE.md and ordering.ts) and are
// never stored, so we don't allow the user to create one of that type.
const USER_BLOCKER_TYPES: BlockerType[] = [
  'legal',
  'access',
  'safety',
  'relationship',
  'readiness',
  'waiting',
  'custom',
]

const SEVERITIES: BlockerSeverity[] = ['minor', 'moderate', 'significant', 'absolute']
const RESOLVABLES: BlockerResolvable[] = ['yes', 'no', 'maybe', 'eventually', 'unknown']

interface BlockersSectionProps {
  slug: string
  entry: ChecklistEntry
  presenceLevel: PresenceLevel
}

interface BlockerDraft {
  type: BlockerType
  label: string
  person_ref: string
  severity: BlockerSeverity | ''
  resolvable: BlockerResolvable
  resolvable_note: string
  workaround_available: boolean
  workaround_note: string
  suppress_workaround: boolean
}

function emptyDraft(): BlockerDraft {
  return {
    type: 'custom',
    label: '',
    person_ref: '',
    severity: '',
    resolvable: 'unknown',
    resolvable_note: '',
    workaround_available: false,
    workaround_note: '',
    suppress_workaround: false,
  }
}

function draftFromBlocker(b: Blocker): BlockerDraft {
  return {
    type: b.type,
    label: b.label,
    person_ref: b.person_ref ?? '',
    severity: b.severity ?? '',
    resolvable: b.resolvable,
    resolvable_note: b.resolvable_note ?? '',
    workaround_available: b.workaround_available,
    workaround_note: b.workaround_note ?? '',
    suppress_workaround: b.suppress_workaround ?? false,
  }
}

function buildBlockerPayload(draft: BlockerDraft): Omit<Blocker, 'id'> {
  const payload: Omit<Blocker, 'id'> = {
    type: draft.type,
    label: draft.label.trim(),
    user_defined: true,
    resolvable: draft.resolvable,
    workaround_available: draft.workaround_available,
  }
  if (draft.type === 'relationship' && draft.person_ref) {
    payload.person_ref = draft.person_ref
  }
  if (draft.severity) {
    payload.severity = draft.severity
  }
  if (draft.resolvable_note.trim()) {
    payload.resolvable_note = draft.resolvable_note.trim()
  }
  if (draft.workaround_available && draft.workaround_note.trim()) {
    payload.workaround_note = draft.workaround_note.trim()
  }
  if (draft.suppress_workaround) {
    payload.suppress_workaround = true
  }
  return payload
}

function shouldShowWorkaroundInline(
  blocker: Blocker,
  presenceLevel: PresenceLevel
): boolean {
  if (blocker.suppress_workaround) return false
  if (!blocker.workaround_available) return false
  if (!blocker.workaround_note) return false
  return presenceLevel === 'some_guidance' || presenceLevel === 'walk_with_me'
}

// ── List rendering ────────────────────────────────────────────────────────────

function BlockerCard({
  blocker,
  presenceLevel,
  onEdit,
  onRemove,
}: {
  blocker: Blocker
  presenceLevel: PresenceLevel
  onEdit: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [showWorkaround, setShowWorkaround] = useState(false)

  const inlineWorkaround = shouldShowWorkaroundInline(blocker, presenceLevel)
  const hasHiddenWorkaround =
    !inlineWorkaround &&
    !blocker.suppress_workaround &&
    blocker.workaround_available &&
    !!blocker.workaround_note

  const people = useAppStore((s) => s.userData.people)
  const personLabel = blocker.person_ref ? people[blocker.person_ref]?.label : null

  return (
    <li className="px-4 py-3 border border-neutral-200 rounded-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              {t(`blockers.type.${blocker.type}`)}
            </span>
            {blocker.severity && (
              <span className="text-xs text-neutral-500">
                · {t(`blockers.severity.${blocker.severity}`)}
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-900">{blocker.label}</p>
          {personLabel && (
            <p className="text-xs text-neutral-500 mt-0.5">
              {t('blockers.person_label', { name: personLabel })}
            </p>
          )}
          <p className="text-xs text-neutral-500 mt-1">
            {t('blockers.resolvable_label')}{' '}
            {t(`blockers.resolvable.${blocker.resolvable}`)}
            {blocker.resolvable_note && (
              <span className="text-neutral-500"> — {blocker.resolvable_note}</span>
            )}
          </p>

          {inlineWorkaround && (
            <div className="mt-2 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded">
              <p className="text-xs font-medium text-neutral-500 mb-1">
                {t('blockers.workaround_heading')}
              </p>
              <p className="text-sm text-neutral-700">{blocker.workaround_note}</p>
            </div>
          )}

          {hasHiddenWorkaround && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowWorkaround((v) => !v)}
                className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
              >
                {showWorkaround
                  ? t('blockers.hide_workaround')
                  : t('blockers.show_workaround')}
              </button>
              {showWorkaround && (
                <div className="mt-2 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded">
                  <p className="text-sm text-neutral-700">{blocker.workaround_note}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
          >
            {t('blockers.edit')}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
          >
            {t('blockers.remove')}
          </button>
        </div>
      </div>
    </li>
  )
}

// ── Form ──────────────────────────────────────────────────────────────────────

function BlockerForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Blocker
  onSubmit: (payload: Omit<Blocker, 'id'>) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<BlockerDraft>(
    initial ? draftFromBlocker(initial) : emptyDraft()
  )
  const people = useAppStore((s) => s.userData.people)
  const peopleList = Object.values(people).sort((a, b) => a.label.localeCompare(b.label))

  const canSubmit = draft.label.trim().length > 0

  function update<K extends keyof BlockerDraft>(key: K, value: BlockerDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSubmit) return
        onSubmit(buildBlockerPayload(draft))
      }}
      className="px-4 py-4 border border-neutral-300 rounded-lg space-y-4"
    >
      <div>
        <label htmlFor="blocker-type" className="block text-xs font-medium text-neutral-500 mb-1">
          {t('blockers.field_type')}
        </label>
        <select
          id="blocker-type"
          value={draft.type}
          onChange={(e) => update('type', e.target.value as BlockerType)}
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
        >
          {USER_BLOCKER_TYPES.map((t_) => (
            <option key={t_} value={t_}>
              {t(`blockers.type.${t_}`)}
            </option>
          ))}
        </select>
        <p className="text-xs text-neutral-500 mt-1">
          {t(`blockers.type_hint.${draft.type}`)}
        </p>
      </div>

      <div>
        <label htmlFor="blocker-label" className="block text-xs font-medium text-neutral-500 mb-1">
          {t('blockers.field_label')}
        </label>
        <input
          id="blocker-label"
          type="text"
          value={draft.label}
          onChange={(e) => update('label', e.target.value)}
          placeholder={t('blockers.field_label_placeholder')}
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
          required
        />
      </div>

      {draft.type === 'relationship' && (
        <div>
          <label htmlFor="blocker-person" className="block text-xs font-medium text-neutral-500 mb-1">
            {t('blockers.field_person')}
          </label>
          {peopleList.length === 0 ? (
            <p className="text-xs text-neutral-500">{t('blockers.no_people_yet')}</p>
          ) : (
            <select
              id="blocker-person"
              value={draft.person_ref}
              onChange={(e) => update('person_ref', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
            >
              <option value="">{t('blockers.field_person_none')}</option>
              {peopleList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div>
        <label htmlFor="blocker-severity" className="block text-xs font-medium text-neutral-500 mb-1">
          {t('blockers.field_severity')}
        </label>
        <select
          id="blocker-severity"
          value={draft.severity}
          onChange={(e) => update('severity', e.target.value as BlockerSeverity | '')}
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
        >
          <option value="">{t('blockers.field_severity_unset')}</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {t(`blockers.severity.${s}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="blocker-resolvable" className="block text-xs font-medium text-neutral-500 mb-1">
          {t('blockers.field_resolvable')}
        </label>
        <select
          id="blocker-resolvable"
          value={draft.resolvable}
          onChange={(e) => update('resolvable', e.target.value as BlockerResolvable)}
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
        >
          {RESOLVABLES.map((r) => (
            <option key={r} value={r}>
              {t(`blockers.resolvable.${r}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="blocker-resolvable-note" className="block text-xs font-medium text-neutral-500 mb-1">
          {t('blockers.field_resolvable_note')}
        </label>
        <input
          id="blocker-resolvable-note"
          type="text"
          value={draft.resolvable_note}
          onChange={(e) => update('resolvable_note', e.target.value)}
          placeholder={t('blockers.field_resolvable_note_placeholder')}
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
        />
      </div>

      {/* Readiness blockers do not get a workaround prompt — see design doc. */}
      {draft.type !== 'readiness' && (
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={draft.workaround_available}
              onChange={(e) => update('workaround_available', e.target.checked)}
              className="mt-0.5"
            />
            <span>{t('blockers.field_workaround_available')}</span>
          </label>
          {draft.workaround_available && (
            <textarea
              value={draft.workaround_note}
              onChange={(e) => update('workaround_note', e.target.value)}
              placeholder={t('blockers.field_workaround_note_placeholder')}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600 resize-none"
            />
          )}
          {draft.workaround_available && (
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
          )}
        </div>
      )}

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

// ── Section ───────────────────────────────────────────────────────────────────

export default function BlockersSection({ slug, entry, presenceLevel }: BlockersSectionProps) {
  const { t } = useTranslation()
  const addBlocker = useAppStore((s) => s.addBlocker)
  const updateBlocker = useAppStore((s) => s.updateBlocker)
  const removeBlocker = useAppStore((s) => s.removeBlocker)

  type Mode = { kind: 'idle' } | { kind: 'adding' } | { kind: 'editing'; id: string }
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })

  // Show only stored (non-document) blockers in the UI. Document blockers
  // are derived elsewhere; if a legacy document blocker is in the data, it
  // is hidden here too so the user can't be confused into managing it.
  const blockers = entry.blockers.filter((b) => b.type !== 'document')
  const editing = mode.kind === 'editing' ? blockers.find((b) => b.id === mode.id) : undefined

  return (
    <section className="mb-8" aria-labelledby="blockers-heading">
      <h2
        id="blockers-heading"
        className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3"
      >
        {t('blockers.heading')}
      </h2>
      <p className="text-xs text-neutral-500 mb-3">{t('blockers.intro')}</p>

      {blockers.length > 0 && (
        <ul className="space-y-2 mb-3">
          {blockers.map((b) => (
            <li key={b.id}>
              {mode.kind === 'editing' && mode.id === b.id ? null : (
                <BlockerCard
                  blocker={b}
                  presenceLevel={presenceLevel}
                  onEdit={() => setMode({ kind: 'editing', id: b.id })}
                  onRemove={() => {
                    removeBlocker(slug, b.id)
                    if (mode.kind === 'editing' && mode.id === b.id) setMode({ kind: 'idle' })
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {mode.kind === 'editing' && editing && (
        <div className="mb-3">
          <BlockerForm
            initial={editing}
            onSubmit={(payload) => {
              updateBlocker(slug, editing.id, payload)
              setMode({ kind: 'idle' })
            }}
            onCancel={() => setMode({ kind: 'idle' })}
          />
        </div>
      )}

      {mode.kind === 'adding' ? (
        <BlockerForm
          onSubmit={(payload) => {
            addBlocker(slug, payload)
            setMode({ kind: 'idle' })
          }}
          onCancel={() => setMode({ kind: 'idle' })}
        />
      ) : (
        mode.kind !== 'editing' && (
          <button
            type="button"
            onClick={() => setMode({ kind: 'adding' })}
            className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
          >
            {blockers.length === 0
              ? t('blockers.add_first')
              : t('blockers.add_another')}
          </button>
        )
      )}
    </section>
  )
}
