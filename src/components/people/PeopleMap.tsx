import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store'
import type {
  Person,
  SafetyLevel,
  SupportLevel,
  ContactFrequency,
} from '../../types'

const SAFETY_LEVELS: SafetyLevel[] = [
  'safe',
  'probably_safe',
  'unsure',
  'probably_unsafe',
  'unsafe',
  'unknown',
]

const SUPPORT_LEVELS: SupportLevel[] = [
  'fully_supportive',
  'supportive_with_effort',
  'words_not_actions',
  'neutral',
  'resistant',
  'actively_hostile',
  'unknown',
]

const CONTACT_FREQUENCIES: ContactFrequency[] = [
  'daily',
  'weekly',
  'monthly',
  'holidays_only',
  'rarely',
  'estranged',
]

interface PersonDraft {
  label: string
  relationship: string
  out_to: boolean
  out_status: string
  safety_level: SafetyLevel | ''
  safety_note: string
  support_level: SupportLevel | ''
  support_note: string
  contact_frequency: ContactFrequency | ''
  items_they_need_to_update: string[]
  user_notes: string
}

function emptyDraft(): PersonDraft {
  return {
    label: '',
    relationship: '',
    out_to: false,
    out_status: '',
    safety_level: '',
    safety_note: '',
    support_level: '',
    support_note: '',
    contact_frequency: '',
    items_they_need_to_update: [],
    user_notes: '',
  }
}

function draftFromPerson(p: Person): PersonDraft {
  return {
    label: p.label,
    relationship: p.relationship,
    out_to: p.out_to,
    out_status: p.out_status,
    safety_level: p.safety_level,
    safety_note: p.safety_note,
    support_level: p.support_level ?? '',
    support_note: p.support_note ?? '',
    contact_frequency: p.contact_frequency ?? '',
    items_they_need_to_update: p.items_they_need_to_update,
    user_notes: p.user_notes,
  }
}

function buildPersonPayload(draft: PersonDraft): Omit<Person, 'id'> {
  return {
    label: draft.label.trim(),
    relationship: draft.relationship.trim(),
    out_to: draft.out_to,
    out_status: draft.out_status.trim(),
    safety_level: draft.safety_level || 'unknown',
    safety_note: draft.safety_note.trim(),
    support_level: draft.support_level || null,
    support_note: draft.support_note.trim() || null,
    contact_frequency: draft.contact_frequency || null,
    items_they_need_to_update: draft.items_they_need_to_update,
    user_notes: draft.user_notes.trim(),
  }
}

// ── Person card ───────────────────────────────────────────────────────────────

function PersonCard({
  person,
  onEdit,
  onRemove,
}: {
  person: Person
  onEdit: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const updateCount = person.items_they_need_to_update.length

  return (
    <li className="px-4 py-3 border border-neutral-200 rounded-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-0.5">
            <p className="text-sm font-medium text-neutral-900">{person.label}</p>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                person.out_to
                  ? 'bg-neutral-100 text-neutral-600'
                  : 'text-neutral-400'
              }`}
            >
              {person.out_to
                ? t('people_map.out_badge_yes')
                : t('people_map.out_badge_no')}
            </span>
          </div>
          {person.relationship && (
            <p className="text-xs text-neutral-500">{person.relationship}</p>
          )}
          {person.safety_level && person.safety_level !== 'unknown' && (
            <p className="text-xs text-neutral-500 mt-0.5">
              {t(`people_map.safety_level.${person.safety_level}`)}
            </p>
          )}
          {updateCount > 0 && (
            <p className="text-xs text-neutral-500 mt-0.5">
              {t('people_map.needs_update_count', { count: updateCount })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
          >
            {t('people_map.edit')}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
          >
            {t('people_map.remove')}
          </button>
        </div>
      </div>
    </li>
  )
}

// ── Person form ───────────────────────────────────────────────────────────────

function PersonForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Person
  onSubmit: (payload: Omit<Person, 'id'>) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<PersonDraft>(
    initial ? draftFromPerson(initial) : emptyDraft()
  )
  const [newUpdateItem, setNewUpdateItem] = useState('')

  const canSubmit = draft.label.trim().length > 0

  function update<K extends keyof PersonDraft>(key: K, value: PersonDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function addUpdateItem() {
    const item = newUpdateItem.trim()
    if (!item) return
    update('items_they_need_to_update', [...draft.items_they_need_to_update, item])
    setNewUpdateItem('')
  }

  function removeUpdateItem(index: number) {
    update(
      'items_they_need_to_update',
      draft.items_they_need_to_update.filter((_, i) => i !== index)
    )
  }

  const inputClass =
    'w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600'
  const labelClass = 'block text-xs font-medium text-neutral-500 mb-1'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSubmit) return
        onSubmit(buildPersonPayload(draft))
      }}
      className="px-4 py-4 border border-neutral-300 rounded-lg space-y-4"
    >
      {/* Label */}
      <div>
        <label htmlFor="person-label" className={labelClass}>
          {t('people_map.field_label')}
        </label>
        <input
          id="person-label"
          type="text"
          value={draft.label}
          onChange={(e) => update('label', e.target.value)}
          placeholder={t('people_map.field_label_placeholder')}
          className={inputClass}
          required
        />
      </div>

      {/* Relationship */}
      <div>
        <label htmlFor="person-relationship" className={labelClass}>
          {t('people_map.field_relationship')}
        </label>
        <input
          id="person-relationship"
          type="text"
          value={draft.relationship}
          onChange={(e) => update('relationship', e.target.value)}
          placeholder={t('people_map.field_relationship_placeholder')}
          className={inputClass}
        />
      </div>

      {/* Out to */}
      <div>
        <p className={labelClass}>{t('people_map.field_out_to')}</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="radio"
              name="out_to"
              checked={draft.out_to}
              onChange={() => update('out_to', true)}
            />
            {t('people_map.field_out_to_yes')}
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="radio"
              name="out_to"
              checked={!draft.out_to}
              onChange={() => update('out_to', false)}
            />
            {t('people_map.field_out_to_no')}
          </label>
        </div>
      </div>

      {/* Out status */}
      <div>
        <label htmlFor="person-out-status" className={labelClass}>
          {t('people_map.field_out_status')}
        </label>
        <input
          id="person-out-status"
          type="text"
          value={draft.out_status}
          onChange={(e) => update('out_status', e.target.value)}
          placeholder={t('people_map.field_out_status_placeholder')}
          className={inputClass}
        />
      </div>

      {/* Safety level */}
      <div>
        <label htmlFor="person-safety-level" className={labelClass}>
          {t('people_map.field_safety_level')}
        </label>
        <select
          id="person-safety-level"
          value={draft.safety_level}
          onChange={(e) => update('safety_level', e.target.value as SafetyLevel | '')}
          className={inputClass}
        >
          <option value="">{t('people_map.field_safety_level_none')}</option>
          {SAFETY_LEVELS.map((sl) => (
            <option key={sl} value={sl}>
              {t(`people_map.safety_level.${sl}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Safety note */}
      <div>
        <label htmlFor="person-safety-note" className={labelClass}>
          {t('people_map.field_safety_note')}
        </label>
        <input
          id="person-safety-note"
          type="text"
          value={draft.safety_note}
          onChange={(e) => update('safety_note', e.target.value)}
          placeholder={t('people_map.field_safety_note_placeholder')}
          className={inputClass}
        />
      </div>

      {/* Support level */}
      <div>
        <label htmlFor="person-support-level" className={labelClass}>
          {t('people_map.field_support_level')}
        </label>
        <select
          id="person-support-level"
          value={draft.support_level}
          onChange={(e) => update('support_level', e.target.value as SupportLevel | '')}
          className={inputClass}
        >
          <option value="">{t('people_map.field_support_level_none')}</option>
          {SUPPORT_LEVELS.map((sl) => (
            <option key={sl} value={sl}>
              {t(`people_map.support_level.${sl}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Support note */}
      <div>
        <label htmlFor="person-support-note" className={labelClass}>
          {t('people_map.field_support_note')}
        </label>
        <input
          id="person-support-note"
          type="text"
          value={draft.support_note}
          onChange={(e) => update('support_note', e.target.value)}
          placeholder={t('people_map.field_support_note_placeholder')}
          className={inputClass}
        />
      </div>

      {/* Contact frequency */}
      <div>
        <label htmlFor="person-contact-frequency" className={labelClass}>
          {t('people_map.field_contact_frequency')}
        </label>
        <select
          id="person-contact-frequency"
          value={draft.contact_frequency}
          onChange={(e) => update('contact_frequency', e.target.value as ContactFrequency | '')}
          className={inputClass}
        >
          <option value="">{t('people_map.field_contact_frequency_none')}</option>
          {CONTACT_FREQUENCIES.map((cf) => (
            <option key={cf} value={cf}>
              {t(`people_map.contact_frequency.${cf}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Items they need to update */}
      <div>
        <p className={labelClass}>{t('people_map.field_items_to_update')}</p>
        <p className="text-xs text-neutral-500 mb-2">
          {t('people_map.field_items_to_update_hint')}
        </p>
        {draft.items_they_need_to_update.length > 0 && (
          <ul className="mb-2 space-y-1">
            {draft.items_they_need_to_update.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm text-neutral-700">
                <span>{item}</span>
                <button
                  type="button"
                  onClick={() => removeUpdateItem(i)}
                  className="text-xs text-neutral-400 hover:text-neutral-700 underline underline-offset-2 shrink-0"
                >
                  {t('people_map.field_items_to_update_remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newUpdateItem}
            onChange={(e) => setNewUpdateItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addUpdateItem()
              }
            }}
            placeholder={t('people_map.field_items_to_update_placeholder')}
            className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600"
          />
          <button
            type="button"
            onClick={addUpdateItem}
            className="px-3 py-2 text-sm text-neutral-600 border border-neutral-300 rounded hover:border-neutral-500"
          >
            {t('people_map.field_items_to_update_add')}
          </button>
        </div>
      </div>

      {/* User notes */}
      <div>
        <label htmlFor="person-notes" className={labelClass}>
          {t('people_map.field_user_notes')}
        </label>
        <textarea
          id="person-notes"
          value={draft.user_notes}
          onChange={(e) => update('user_notes', e.target.value)}
          placeholder={t('people_map.field_user_notes_placeholder')}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-600 resize-none"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-4 py-1.5 text-sm bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed"
        >
          {initial ? t('people_map.save_changes') : t('people_map.save_new')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-sm text-neutral-600 hover:text-neutral-900"
        >
          {t('people_map.cancel')}
        </button>
      </div>
    </form>
  )
}

// ── Things Others Need to Update ──────────────────────────────────────────────

function ThingsToUpdateSection({ people }: { people: Person[] }) {
  const { t } = useTranslation()

  const withItems = people.filter((p) => p.items_they_need_to_update.length > 0)

  return (
    <section className="mt-10" aria-labelledby="things-to-update-heading">
      <h2
        id="things-to-update-heading"
        className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1"
      >
        {t('people_map.things_to_update_heading')}
      </h2>
      <p className="text-xs text-neutral-500 mb-4">
        {t('people_map.things_to_update_intro')}
      </p>

      {withItems.length === 0 ? (
        <p className="text-sm text-neutral-500">{t('people_map.things_to_update_empty')}</p>
      ) : (
        <ul className="space-y-4">
          {withItems.map((p) => (
            <li key={p.id}>
              <p className="text-sm font-medium text-neutral-900 mb-1">{p.label}</p>
              <ul className="space-y-0.5">
                {p.items_they_need_to_update.map((item, i) => (
                  <li key={i} className="text-sm text-neutral-600 pl-3 border-l border-neutral-200">
                    {item}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PeopleMap() {
  const { t } = useTranslation()
  const people = useAppStore((s) => s.userData.people)
  const addPerson = useAppStore((s) => s.addPerson)
  const updatePerson = useAppStore((s) => s.updatePerson)
  const removePerson = useAppStore((s) => s.removePerson)

  type Mode = { kind: 'idle' } | { kind: 'adding' } | { kind: 'editing'; id: string }
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })

  const peopleList = Object.values(people).sort((a, b) => a.label.localeCompare(b.label))
  const editing =
    mode.kind === 'editing' ? peopleList.find((p) => p.id === mode.id) : undefined

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <Link
            to="/dashboard"
            className="text-sm text-neutral-600 hover:text-neutral-900"
          >
            {t('people_map.back')}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        <h1 className="text-xl font-semibold text-neutral-900 mb-2">
          {t('people_map.title')}
        </h1>
        <p className="text-sm text-neutral-500 mb-8">{t('people_map.intro')}</p>

        {/* People list */}
        {peopleList.length > 0 && (
          <ul className="space-y-2 mb-4">
            {peopleList.map((p) =>
              mode.kind === 'editing' && mode.id === p.id ? null : (
                <PersonCard
                  key={p.id}
                  person={p}
                  onEdit={() => setMode({ kind: 'editing', id: p.id })}
                  onRemove={() => {
                    removePerson(p.id)
                    if (mode.kind === 'editing' && mode.id === p.id) {
                      setMode({ kind: 'idle' })
                    }
                  }}
                />
              )
            )}
          </ul>
        )}

        {/* Edit form */}
        {mode.kind === 'editing' && editing && (
          <div className="mb-4">
            <PersonForm
              initial={editing}
              onSubmit={(payload) => {
                updatePerson(editing.id, payload)
                setMode({ kind: 'idle' })
              }}
              onCancel={() => setMode({ kind: 'idle' })}
            />
          </div>
        )}

        {/* Add form or button */}
        {mode.kind === 'adding' ? (
          <PersonForm
            onSubmit={(payload) => {
              addPerson(payload)
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
              {peopleList.length === 0
                ? t('people_map.add_first')
                : t('people_map.add_another')}
            </button>
          )
        )}

        <ThingsToUpdateSection people={peopleList} />
      </main>
    </div>
  )
}
