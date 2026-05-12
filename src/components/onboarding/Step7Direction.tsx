import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import WizardLayout from './WizardLayout'
import type { StepProps } from './OnboardingWizard'
import { useAppStore } from '../../store'
import { ASPIRATIONS, PRIORITY_VALUES, type Aspiration } from '../../utils/onboarding'
import type { ItemPriority } from '../../types'

// Broad-direction step. The user picks a priority for each aspiration that
// applies to them. Skipping an aspiration entirely is the default — the picker
// uses "Maybe / not now" as the absence state rather than asking "is this you?"
// for every item.
//
// Priority values:
//   now      — actively working on this
//   soon     — want to get to this in the foreseeable future
//   someday  — meaningful but not a current focus
//   unsure   — there are feelings here; gentle later-nudges welcome
//   (unset)  — no opinion, not surfaced anywhere

export default function Step7Direction({ step, onBack, onSkip, onNext }: StepProps) {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const patchProfile = useAppStore((s) => s.patchProfile)

  const current = profile.onboarding_aspirations ?? {}

  // Filter aspirations to user's active tracks. If no tracks chosen, show all
  // (the user signaled wanting to explore broadly).
  const visible = useMemo<Aspiration[]>(() => {
    if (profile.active_tracks.length === 0) return ASPIRATIONS
    const set = new Set(profile.active_tracks)
    return ASPIRATIONS.filter((a) => set.has(a.track))
  }, [profile.active_tracks])

  const setPriority = (slug: string, priority: ItemPriority | null) => {
    const next = { ...current }
    if (priority === null) delete next[slug]
    else next[slug] = priority
    patchProfile({ onboarding_aspirations: next })
  }

  return (
    <WizardLayout
      step={step}
      title={t('onboarding.steps.direction.title')}
      subtitle={t('onboarding.steps.direction.subtitle')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <p className="text-xs text-neutral-500 leading-relaxed mb-5">
        {t('onboarding.steps.direction.hint')}
      </p>
      <div className="space-y-3">
        {visible.map((aspiration) => (
          <AspirationRow
            key={aspiration.slug}
            aspiration={aspiration}
            value={current[aspiration.slug] ?? null}
            onChange={(p) => setPriority(aspiration.slug, p)}
          />
        ))}
      </div>
      <p className="mt-6 text-xs text-neutral-500 leading-relaxed">
        {t('onboarding.steps.direction.footer')}
      </p>
    </WizardLayout>
  )
}

interface AspirationRowProps {
  aspiration: Aspiration
  value: ItemPriority | null
  onChange: (p: ItemPriority | null) => void
}

function AspirationRow({ aspiration, value, onChange }: AspirationRowProps) {
  const { t } = useTranslation()
  const label = t(`onboarding.steps.direction.aspirations.${aspiration.i18n_key}.label`)
  const description = t(`onboarding.steps.direction.aspirations.${aspiration.i18n_key}.description`)

  return (
    <div className="border border-neutral-200 rounded-md">
      <div className="px-3 py-2 border-b border-neutral-100">
        <div className="text-sm font-medium text-neutral-900">{label}</div>
        <div className="text-xs text-neutral-600 mt-0.5 leading-relaxed">{description}</div>
      </div>
      <div className="px-3 py-2 flex flex-wrap gap-2">
        {PRIORITY_VALUES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(value === p ? null : p)}
            className={`px-3 py-1.5 text-xs rounded-md border ${
              value === p
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {t(`onboarding.steps.direction.priority.${p}`)}
          </button>
        ))}
        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="px-3 py-1.5 text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            {t('onboarding.steps.direction.unset')}
          </button>
        )}
      </div>
    </div>
  )
}
