import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import { groupItemsByTrackAndCategory } from '../../utils/onboarding'
import type { CustomItem, ItemIntent, ItemStatus, KBItem } from '../../types'

// Reusable grouped + searchable + bulk-mark item editor. Used by:
//   - Onboarding Step 8 (with aspiration prefill applied by its container)
//   - Settings "Manage your list" section
//
// This component is purely a list editor — it never spawns skeleton items
// or processes aspiration data. The aspiration prefill effect lives in
// Step 8 specifically and runs around this component.

const TRACKS_WITH_RELATIONSHIP_NOTE = new Set(['social', 'personal', 'supporter'])
const INTENT_VALUES: ItemIntent[] = ['update', 'not_applicable', 'not_wanted', 'unknown']

export default function BulkIntentEditor() {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const checklist = useAppStore((s) => s.userData.checklist)
  const customItems = useAppStore((s) => s.userData.custom_items)
  const kb = useAppStore((s) => s.kb)
  const addItem = useAppStore((s) => s.addItemToChecklist)
  const removeItem = useAppStore((s) => s.removeItemFromChecklist)
  const addCustom = useAppStore((s) => s.addCustomItem)
  const removeCustom = useAppStore((s) => s.removeCustomItem)
  const setIntent = useAppStore((s) => s.setItemIntent)

  const [query, setQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    if (!kb) return []
    return groupItemsByTrackAndCategory(
      kb,
      profile.active_tracks,
      profile.jurisdiction,
      profile.birth_jurisdiction ?? null
    )
  }, [kb, profile.active_tracks, profile.jurisdiction, profile.birth_jurisdiction])

  const trimmedQuery = query.trim().toLowerCase()
  const matchesQuery = (label: string) =>
    trimmedQuery.length === 0 || label.toLowerCase().includes(trimmedQuery)

  const isOnList = (slug: string) => Boolean(checklist[slug])
  const currentIntent = (slug: string): ItemIntent | null => checklist[slug]?.intent ?? null
  const currentStatus = (slug: string): ItemStatus | null => checklist[slug]?.status ?? null

  const setSlugIntent = (slug: string, intent: ItemIntent) => {
    if (!isOnList(slug)) addItem(slug)
    setIntent(slug, intent)
  }

  const markCategoryAs = (categorySlug: string, items: KBItem[], intent: ItemIntent) => {
    for (const item of items) {
      if (!matchesQuery(item.label)) continue
      setSlugIntent(item.slug, intent)
    }
    for (const c of customItems.filter((x) => x.category === categorySlug)) {
      if (!matchesQuery(c.label)) continue
      setIntent(c.id, intent)
    }
  }

  const toggleCategoryCollapse = (categorySlug: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categorySlug)) next.delete(categorySlug)
      else next.add(categorySlug)
      return next
    })
  }

  const handleAddCustom = (categorySlug: string, track: string, label: string) => {
    addCustom({ label, category: categorySlug, track, notes: '' })
  }

  const totalOnList = Object.keys(checklist).length

  // Custom items spawned from aspirations whose category isn't in any track
  // group get their own section so they don't disappear.
  const aspirationSkeletons = customItems.filter((c) => c.provenance === 'aspiration_skeleton')
  const shownCategories = new Set<string>()
  for (const group of groups) for (const cat of group.categories) shownCategories.add(cat.categorySlug)
  const orphanSkeletons = aspirationSkeletons.filter((c) => !shownCategories.has(c.category))

  return (
    <div className="space-y-6">
      <div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('onboarding.steps.bulk_intent.search_placeholder')}
          className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
        />
      </div>

      {groups.length === 0 && (
        <p className="text-sm text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-3 leading-relaxed">
          {t('onboarding.steps.bulk_intent.no_kb_yet')}
        </p>
      )}

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.trackSlug}>
            <h3 className="text-base font-semibold text-neutral-900 mb-3">{group.trackLabel}</h3>

            {TRACKS_WITH_RELATIONSHIP_NOTE.has(group.trackSlug) && (
              <p className="text-xs text-neutral-600 italic leading-relaxed mb-4">
                {t('onboarding.steps.bulk_intent.relationship_note')}
              </p>
            )}

            <div className="space-y-5">
              {group.categories.map((cat) => {
                const collapsed = collapsedCategories.has(cat.categorySlug)
                const itemsInCategory = cat.items.filter((i) => matchesQuery(i.label))
                const customsInCategory = customItems.filter(
                  (c) => c.category === cat.categorySlug && matchesQuery(c.label)
                )
                if (trimmedQuery && itemsInCategory.length === 0 && customsInCategory.length === 0) {
                  return null
                }
                return (
                  <div key={cat.categorySlug} className="border border-neutral-200 rounded-md">
                    <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-neutral-100 flex-wrap">
                      <div className="text-sm font-medium text-neutral-800">{cat.categoryLabel}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {INTENT_VALUES.map((iv) => (
                          <button
                            key={iv}
                            type="button"
                            onClick={() => markCategoryAs(cat.categorySlug, cat.items, iv)}
                            className="text-xs text-neutral-600 underline-offset-2 hover:underline px-1.5 py-0.5"
                            title={t('onboarding.steps.bulk_intent.mark_all_as', {
                              intent: t(`item.intent.${iv}`),
                            })}
                          >
                            {t(`onboarding.steps.bulk_intent.mark_all.${iv}`)}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => toggleCategoryCollapse(cat.categorySlug)}
                          className="text-xs text-neutral-500 underline-offset-2 hover:underline"
                        >
                          {collapsed
                            ? t('onboarding.steps.bulk_intent.expand')
                            : t('onboarding.steps.bulk_intent.collapse')}
                        </button>
                      </div>
                    </div>
                    {!collapsed && (
                      <div className="px-3 py-2 space-y-2">
                        {itemsInCategory.map((item) => (
                          <ItemRow
                            key={item.slug}
                            label={item.label}
                            description={item.description}
                            intent={currentIntent(item.slug)}
                            status={currentStatus(item.slug)}
                            onSetIntent={(i) => setSlugIntent(item.slug, i)}
                            onRemove={() => removeItem(item.slug)}
                          />
                        ))}
                        {customsInCategory.map((c) => (
                          <CustomItemRow
                            key={c.id}
                            custom={c}
                            intent={currentIntent(c.id)}
                            onSetIntent={(i) => setIntent(c.id, i)}
                            onRemove={() => removeCustom(c.id)}
                          />
                        ))}
                        <AddCustomRow
                          onAdd={(label) => handleAddCustom(cat.categorySlug, group.trackSlug, label)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        {orphanSkeletons.length > 0 && (
          <section>
            <h3 className="text-base font-semibold text-neutral-900 mb-3">
              {t('onboarding.steps.bulk_intent.skeletons_heading')}
            </h3>
            <p className="text-xs text-neutral-600 italic leading-relaxed mb-4">
              {t('onboarding.steps.bulk_intent.skeletons_note')}
            </p>
            <div className="border border-neutral-200 rounded-md px-3 py-2 space-y-2">
              {orphanSkeletons
                .filter((c) => matchesQuery(c.label))
                .map((c) => (
                  <CustomItemRow
                    key={c.id}
                    custom={c}
                    intent={currentIntent(c.id)}
                    onSetIntent={(i) => setIntent(c.id, i)}
                    onRemove={() => removeCustom(c.id)}
                  />
                ))}
            </div>
          </section>
        )}

        {totalOnList > 0 && (
          <p className="text-xs text-neutral-500">
            {totalOnList === 1
              ? t('onboarding.steps.bulk_intent.selected_count_one')
              : t('onboarding.steps.bulk_intent.selected_count_other', { count: totalOnList })}
          </p>
        )}
      </div>
    </div>
  )
}

interface ItemRowProps {
  label: string
  description: string | null
  intent: ItemIntent | null
  status?: ItemStatus | null
  onSetIntent: (i: ItemIntent) => void
  onRemove: () => void
}

function ItemRow({ label, description, intent, status, onSetIntent, onRemove }: ItemRowProps) {
  const { t } = useTranslation()
  const isPolicyBlocked = status === 'policy_blocked'
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 px-2 py-2 rounded hover:bg-neutral-50">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-neutral-900">{label}</div>
        {description && (
          <div className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{description}</div>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {INTENT_VALUES.map((iv) => (
          <button
            key={iv}
            type="button"
            onClick={() => onSetIntent(iv)}
            className={`px-2 py-1 text-xs rounded-md border ${
              intent === iv
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {iv === 'update' && isPolicyBlocked
              ? t('item.intent.update_policy_blocked')
              : t(`onboarding.steps.bulk_intent.intent_short.${iv}`)}
          </button>
        ))}
        {intent !== null && (
          <button
            type="button"
            onClick={onRemove}
            className="px-2 py-1 text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            {t('onboarding.steps.bulk_intent.off_list')}
          </button>
        )}
      </div>
    </div>
  )
}

interface CustomItemRowProps {
  custom: CustomItem
  intent: ItemIntent | null
  onSetIntent: (i: ItemIntent) => void
  onRemove: () => void
}

function CustomItemRow({ custom, intent, onSetIntent, onRemove }: CustomItemRowProps) {
  return (
    <ItemRow
      label={custom.label}
      description={custom.description ?? null}
      intent={intent}
      onSetIntent={onSetIntent}
      onRemove={onRemove}
    />
  )
}

function AddCustomRow({ onAdd }: { onAdd: (label: string) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-neutral-600 underline-offset-2 hover:underline"
      >
        {t('onboarding.steps.bulk_intent.add_custom')}
      </button>
    )
  }

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setOpen(false)
      return
    }
    onAdd(trimmed)
    setText('')
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') {
            setText('')
            setOpen(false)
          }
        }}
        placeholder={t('onboarding.steps.bulk_intent.custom_placeholder')}
        className="flex-1 px-2 py-1 border border-neutral-300 rounded-md text-sm"
      />
      <button
        type="button"
        onClick={submit}
        className="px-3 py-1 text-sm bg-neutral-900 text-white rounded-md"
      >
        {t('onboarding.steps.bulk_intent.custom_add_button')}
      </button>
      <button
        type="button"
        onClick={() => {
          setText('')
          setOpen(false)
        }}
        className="text-xs text-neutral-500"
      >
        {t('onboarding.steps.bulk_intent.custom_cancel')}
      </button>
    </div>
  )
}
