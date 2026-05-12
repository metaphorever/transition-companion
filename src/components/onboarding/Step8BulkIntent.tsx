import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import WizardLayout from './WizardLayout'
import BulkIntentEditor from './BulkIntentEditor'
import type { StepProps } from './OnboardingWizard'
import { useAppStore } from '../../store'
import { resolveAspirations } from '../../utils/onboarding'

// Onboarding wrapper around BulkIntentEditor. Adds the aspiration prefill
// effect: when entering the step, items matching user aspirations get added
// to the checklist with intent=update + the aspiration's priority. For
// aspirations with no KB match in the user's jurisdiction, a skeleton custom
// item is spawned. The applied set is tracked so revisits don't re-apply.

export default function Step8BulkIntent({ step, onBack, onSkip, onNext }: StepProps) {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const checklist = useAppStore((s) => s.userData.checklist)
  const customItems = useAppStore((s) => s.userData.custom_items)
  const kb = useAppStore((s) => s.kb)
  const addItem = useAppStore((s) => s.addItemToChecklist)
  const setIntent = useAppStore((s) => s.setItemIntent)
  const setPriority = useAppStore((s) => s.setItemPriority)
  const addCustom = useAppStore((s) => s.addCustomItem)
  const patchProfile = useAppStore((s) => s.patchProfile)

  useEffect(() => {
    if (!kb) return
    const aspirations = profile.onboarding_aspirations ?? {}
    if (Object.keys(aspirations).length === 0) return
    const applied = new Set(profile.onboarding_aspirations_applied ?? [])
    const resolutions = resolveAspirations(aspirations, kb, profile.jurisdiction)
    const newlyApplied: string[] = []
    for (const r of resolutions) {
      if (applied.has(r.aspiration.slug)) continue
      for (const slug of r.matched_kb_slugs) {
        if (!checklist[slug]) addItem(slug)
        setIntent(slug, 'update')
        setPriority(slug, r.priority)
      }
      if (!r.has_kb_match) {
        const already = customItems.find((c) => c.aspiration_slug === r.aspiration.slug)
        if (!already) {
          const label = t(
            `onboarding.steps.direction.aspirations.${r.aspiration.i18n_key}.label`
          )
          addCustom({
            label,
            category: r.aspiration.skeleton_category,
            track: r.aspiration.track,
            notes: '',
            provenance: 'aspiration_skeleton',
            aspiration_slug: r.aspiration.slug,
            description: t('onboarding.steps.bulk_intent.skeleton_description'),
          })
        }
      }
      newlyApplied.push(r.aspiration.slug)
    }
    if (newlyApplied.length > 0) {
      patchProfile({
        onboarding_aspirations_applied: [
          ...(profile.onboarding_aspirations_applied ?? []),
          ...newlyApplied,
        ],
      })
    }
    // Guarded by per-aspiration `applied` set — safe to omit other deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kb])

  return (
    <WizardLayout
      step={step}
      title={t('onboarding.steps.bulk_intent.title')}
      subtitle={t('onboarding.steps.bulk_intent.subtitle')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <p className="text-xs text-neutral-500 leading-relaxed mb-5">
        {t('onboarding.steps.bulk_intent.hint')}
      </p>
      <BulkIntentEditor />
    </WizardLayout>
  )
}
