import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import WizardLayout from './WizardLayout'
import type { StepProps } from './OnboardingWizard'
import { useAppStore } from '../../store'
import { groupItemsByTrackAndCategory } from '../../utils/onboarding'
import type { CustomItem } from '../../types'

const TRACKS_WITH_RELATIONSHIP_NOTE = new Set(['social', 'personal', 'supporter'])

export default function Step7Categories({ step, onBack, onSkip, onNext }: StepProps) {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const checklist = useAppStore((s) => s.userData.checklist)
  const customItems = useAppStore((s) => s.userData.custom_items)
  const kb = useAppStore((s) => s.kb)
  const addItem = useAppStore((s) => s.addItemToChecklist)
  const removeItem = useAppStore((s) => s.removeItemFromChecklist)
  const addCustom = useAppStore((s) => s.addCustomItem)
  const removeCustom = useAppStore((s) => s.removeCustomItem)

  // Local-only: which categories the user has chosen to collapse for this
  // session. Not persisted because it's a UI affordance, not a decision.
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    if (!kb) return []
    return groupItemsByTrackAndCategory(kb, profile.active_tracks, profile.jurisdiction)
  }, [kb, profile.active_tracks, profile.jurisdiction])

  const totalSelected =
    Object.keys(checklist).length + customItems.length

  const toggleCategoryCollapse = (categorySlug: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categorySlug)) next.delete(categorySlug)
      else next.add(categorySlug)
      return next
    })
  }

  const isOnList = (slug: string) => Boolean(checklist[slug])

  const toggleItem = (slug: string, checked: boolean) => {
    if (checked) addItem(slug)
    else removeItem(slug)
  }

  const handleAddCustom = (category: string, track: string, label: string) => {
    addCustom({ label, category, track, notes: '' })
  }

  const customForCategory = (categorySlug: string) =>
    customItems.filter((c) => c.category === categorySlug)

  return (
    <WizardLayout
      step={step}
      title={t('onboarding.steps.categories.title')}
      subtitle={t('onboarding.steps.categories.subtitle')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <div className="space-y-8">
        {groups.length === 0 && (
          <p className="text-sm text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-3 leading-relaxed">
            {t('onboarding.steps.categories.no_kb_yet')}
          </p>
        )}

        {groups.map((group) => (
          <section key={group.trackSlug}>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">
              {group.trackLabel}
            </h2>

            {TRACKS_WITH_RELATIONSHIP_NOTE.has(group.trackSlug) && (
              <p className="text-xs text-neutral-600 italic leading-relaxed mb-4">
                {t('onboarding.steps.categories.relationship_note')}
              </p>
            )}

            <div className="space-y-5">
              {group.categories.map((cat) => {
                const collapsed = collapsedCategories.has(cat.categorySlug)
                const customs = customForCategory(cat.categorySlug)
                return (
                  <div
                    key={cat.categorySlug}
                    className="border border-neutral-200 rounded-md"
                  >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100">
                      <div className="text-sm font-medium text-neutral-800">
                        {cat.categoryLabel}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCategoryCollapse(cat.categorySlug)}
                        className="text-xs text-neutral-500 underline-offset-2 hover:underline"
                      >
                        {collapsed
                          ? t('onboarding.steps.categories.track_skipped')
                          : t('onboarding.steps.categories.skip_category')}
                      </button>
                    </div>
                    {!collapsed && (
                      <div className="px-3 py-2 space-y-2">
                        {cat.items.map((item) => (
                          <label
                            key={item.slug}
                            className="flex items-start gap-3 px-2 py-1.5 rounded cursor-pointer hover:bg-neutral-50"
                          >
                            <input
                              type="checkbox"
                              checked={isOnList(item.slug)}
                              onChange={(e) => toggleItem(item.slug, e.target.checked)}
                              className="mt-1 accent-neutral-900"
                            />
                            <div>
                              <div className="text-sm text-neutral-900">{item.label}</div>
                              {item.description && (
                                <div className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                        {customs.map((c) => (
                          <CustomRow key={c.id} custom={c} onRemove={removeCustom} />
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

        {/* If no KB groups loaded, still let the user add custom items
            against a generic "personal" bucket so they aren't blocked. */}
        {groups.length === 0 && (
          <UnboundCustomList
            customItems={customItems}
            onAdd={(label) => addCustom({ label, category: 'uncategorized', track: 'personal', notes: '' })}
            onRemove={removeCustom}
          />
        )}

        {totalSelected > 0 && (
          <p className="text-xs text-neutral-500">
            {totalSelected === 1
              ? t('onboarding.steps.categories.selected_count_one')
              : t('onboarding.steps.categories.selected_count_other', { count: totalSelected })}
          </p>
        )}
      </div>
    </WizardLayout>
  )
}

function CustomRow({ custom, onRemove }: { custom: CustomItem; onRemove: (id: string) => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded bg-neutral-50">
      <div className="text-sm text-neutral-900">{custom.label}</div>
      <button
        type="button"
        onClick={() => onRemove(custom.id)}
        className="text-xs text-neutral-500 underline-offset-2 hover:underline"
      >
        {t('onboarding.steps.categories.remove_custom')}
      </button>
    </div>
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
        {t('onboarding.steps.categories.add_custom')}
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
        placeholder={t('onboarding.steps.categories.custom_placeholder')}
        className="flex-1 px-2 py-1 border border-neutral-300 rounded-md text-sm"
      />
      <button
        type="button"
        onClick={submit}
        className="px-3 py-1 text-sm bg-neutral-900 text-white rounded-md"
      >
        {t('onboarding.steps.categories.custom_add_button')}
      </button>
      <button
        type="button"
        onClick={() => {
          setText('')
          setOpen(false)
        }}
        className="text-xs text-neutral-500"
      >
        {t('onboarding.steps.categories.custom_cancel')}
      </button>
    </div>
  )
}

function UnboundCustomList({
  customItems,
  onAdd,
  onRemove,
}: {
  customItems: CustomItem[]
  onAdd: (label: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="border border-neutral-200 rounded-md p-3 space-y-2">
      {customItems.map((c) => (
        <CustomRow key={c.id} custom={c} onRemove={onRemove} />
      ))}
      <AddCustomRow onAdd={onAdd} />
    </div>
  )
}
