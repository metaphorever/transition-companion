import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store'
import { getEffectiveDueDate, dueDateLabel } from '../../utils/recurring'
import type { RecurringItem, RecurringItemMode } from '../../types'

const TRACKS = ['legal', 'medical', 'social', 'personal', 'supporter'] as const
const MODES: RecurringItemMode[] = ['fixed', 'manual', 'open']

const EMPTY_FORM = {
  label: '',
  mode: 'fixed' as RecurringItemMode,
  interval_days: '' as string | number,
  next_date: '',
  track: 'personal',
  notes: '',
}

function RecurringItemCard({
  item,
  today,
  onEdit,
  onRemove,
  onLog,
}: {
  item: RecurringItem
  today: string
  onEdit: (item: RecurringItem) => void
  onRemove: (id: string) => void
  onLog: (id: string) => void
}) {
  const { t } = useTranslation()
  const due = getEffectiveDueDate(item)
  const isOverdue = due !== null && due < today
  const isDueToday = due === today

  return (
    <div
      className={`px-4 py-3 border rounded-lg ${
        isOverdue || isDueToday ? 'border-neutral-400' : 'border-neutral-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900">{item.label}</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t(`recurring.mode.${item.mode}`)}
            {item.mode === 'fixed' && item.interval_days && (
              <> &middot; {t('recurring.every_n_days', { n: item.interval_days })}</>
            )}
            {item.track && (
              <> &middot; {t(`dashboard.tracks.${item.track}`, { defaultValue: item.track })}</>
            )}
          </p>
          {due && (
            <p className={`text-xs mt-1 ${isOverdue ? 'text-neutral-700 font-medium' : 'text-neutral-400'}`}>
              {isOverdue || isDueToday
                ? t('recurring.due_label', { label: dueDateLabel(due, today) })
                : t('recurring.upcoming_label', { label: dueDateLabel(due, today) })}
            </p>
          )}
          {item.last_logged_at && (
            <p className="text-xs text-neutral-400 mt-0.5">
              {t('recurring.last_logged', { date: item.last_logged_at })}
            </p>
          )}
          {item.notes && (
            <p className="text-xs text-neutral-500 mt-1">{item.notes}</p>
          )}
        </div>
        <div className="flex flex-col gap-1 items-end flex-shrink-0">
          <button
            type="button"
            onClick={() => onLog(item.id)}
            className="px-3 py-1.5 bg-neutral-900 text-white text-xs rounded"
          >
            {t('recurring.log')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="text-xs text-neutral-400 hover:text-neutral-700"
            >
              {t('recurring.edit')}
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="text-xs text-neutral-400 hover:text-neutral-700"
            >
              {t('recurring.remove')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RecurringItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: typeof EMPTY_FORM
  onSave: (values: typeof EMPTY_FORM) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [values, setValues] = useState(initial)

  const set = (k: keyof typeof EMPTY_FORM, v: string | number) =>
    setValues((prev) => ({ ...prev, [k]: v }))

  return (
    <div className="px-4 py-4 border border-neutral-300 rounded-lg space-y-3">
      <div>
        <label className="text-xs text-neutral-500 block mb-1">{t('recurring.form_label')}</label>
        <input
          type="text"
          value={values.label}
          onChange={(e) => set('label', e.target.value)}
          placeholder={t('recurring.form_label_placeholder')}
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-600"
          autoFocus
        />
      </div>

      <div>
        <label className="text-xs text-neutral-500 block mb-1">{t('recurring.form_mode')}</label>
        <select
          value={values.mode}
          onChange={(e) => set('mode', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-600 bg-white"
        >
          {MODES.map((m) => (
            <option key={m} value={m}>{t(`recurring.mode.${m}`)}</option>
          ))}
        </select>
        <p className="text-xs text-neutral-400 mt-1">{t(`recurring.mode_hint.${values.mode}`)}</p>
      </div>

      {values.mode === 'fixed' && (
        <div>
          <label className="text-xs text-neutral-500 block mb-1">{t('recurring.form_interval')}</label>
          <input
            type="number"
            min={1}
            value={values.interval_days}
            onChange={(e) => set('interval_days', e.target.value)}
            placeholder={t('recurring.form_interval_placeholder')}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-600"
          />
        </div>
      )}

      {values.mode === 'manual' && (
        <div>
          <label className="text-xs text-neutral-500 block mb-1">{t('recurring.form_next_date')}</label>
          <input
            type="date"
            value={values.next_date}
            onChange={(e) => set('next_date', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-600"
          />
        </div>
      )}

      <div>
        <label className="text-xs text-neutral-500 block mb-1">{t('recurring.form_track')}</label>
        <select
          value={values.track}
          onChange={(e) => set('track', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-600 bg-white"
        >
          {TRACKS.map((tr) => (
            <option key={tr} value={tr}>{t(`dashboard.tracks.${tr}`)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-neutral-500 block mb-1">{t('recurring.form_notes')}</label>
        <input
          type="text"
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder={t('recurring.form_notes_placeholder')}
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-600"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave(values)}
          disabled={!values.label.trim()}
          className="px-4 py-2 bg-neutral-900 text-white text-sm rounded-lg font-medium disabled:opacity-40"
        >
          {t('recurring.save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900"
        >
          {t('recurring.cancel')}
        </button>
      </div>
    </div>
  )
}

export default function RecurringItems() {
  const { t } = useTranslation()
  const recurringItems = useAppStore((s) => s.userData.recurring_items ?? [])
  const addRecurringItem = useAppStore((s) => s.addRecurringItem)
  const updateRecurringItem = useAppStore((s) => s.updateRecurringItem)
  const removeRecurringItem = useAppStore((s) => s.removeRecurringItem)
  const logRecurringItem = useAppStore((s) => s.logRecurringItem)

  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM)

  const today = new Date().toISOString().split('T')[0]

  const handleAdd = (values: typeof EMPTY_FORM) => {
    if (!values.label.trim()) return
    addRecurringItem({
      label: values.label.trim(),
      mode: values.mode,
      interval_days: values.mode === 'fixed' && values.interval_days
        ? Number(values.interval_days)
        : null,
      next_date: values.mode === 'manual' && values.next_date ? values.next_date : null,
      last_logged_at: null,
      track: values.track,
      notes: values.notes.trim(),
    })
    setShowAdd(false)
  }

  const startEdit = (item: RecurringItem) => {
    setEditingId(item.id)
    setEditForm({
      label: item.label,
      mode: item.mode,
      interval_days: item.interval_days ?? '',
      next_date: item.next_date ?? '',
      track: item.track,
      notes: item.notes,
    })
  }

  const handleEditSave = (values: typeof EMPTY_FORM) => {
    if (!editingId || !values.label.trim()) return
    updateRecurringItem(editingId, {
      label: values.label.trim(),
      mode: values.mode,
      interval_days: values.mode === 'fixed' && values.interval_days
        ? Number(values.interval_days)
        : null,
      next_date: values.mode === 'manual' && values.next_date ? values.next_date : null,
      track: values.track,
      notes: values.notes.trim(),
    })
    setEditingId(null)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/dashboard" className="text-sm text-neutral-600 hover:text-neutral-900">
            {t('recurring.back')}
          </Link>
          <span className="text-sm font-medium text-neutral-900">{t('recurring.title')}</span>
          <div className="w-20" />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        <p className="text-sm text-neutral-600 mb-6">{t('recurring.intro')}</p>

        {recurringItems.length === 0 && !showAdd && (
          <p className="text-sm text-neutral-400 mb-6">{t('recurring.empty')}</p>
        )}

        {recurringItems.length > 0 && (
          <div className="space-y-3 mb-6">
            {recurringItems.map((item) =>
              editingId === item.id ? (
                <RecurringItemForm
                  key={item.id}
                  initial={editForm}
                  onSave={handleEditSave}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <RecurringItemCard
                  key={item.id}
                  item={item}
                  today={today}
                  onEdit={startEdit}
                  onRemove={removeRecurringItem}
                  onLog={logRecurringItem}
                />
              )
            )}
          </div>
        )}

        {showAdd ? (
          <RecurringItemForm
            initial={EMPTY_FORM}
            onSave={handleAdd}
            onCancel={() => setShowAdd(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="text-sm text-neutral-500 hover:text-neutral-900 underline-offset-2 hover:underline"
          >
            + {t('recurring.add')}
          </button>
        )}
      </main>
    </div>
  )
}
