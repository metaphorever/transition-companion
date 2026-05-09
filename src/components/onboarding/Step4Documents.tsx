import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import WizardLayout from './WizardLayout'
import type { StepProps } from './OnboardingWizard'
import { useAppStore } from '../../store'
import { ONBOARDING_DOCUMENT_KEYS, type OnboardingDocumentKey } from '../../utils/onboarding'

const NEGATIVE_OPTIONS = ['none', 'not_sure'] as const
type NegativeOption = (typeof NEGATIVE_OPTIONS)[number]

export default function Step4Documents({ step, onBack, onSkip, onNext }: StepProps) {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const patchProfile = useAppStore((s) => s.patchProfile)

  const docs = useMemo(() => new Set(profile.documents_obtained as OnboardingDocumentKey[]), [
    profile.documents_obtained,
  ])
  const negative = profile.documents_response

  const showNoDocsNote = negative !== null && docs.size === 0

  const toggleDoc = (key: OnboardingDocumentKey, checked: boolean) => {
    const next = new Set(docs)
    if (checked) next.add(key)
    else next.delete(key)
    patchProfile({
      documents_obtained: Array.from(next),
      // Picking any real document clears the negative response. Unchecking
      // doesn't reassert one — that requires the user to pick "none" / "not
      // sure" explicitly.
      documents_response: checked ? null : negative,
    })
  }

  const setNegative = (key: NegativeOption) => {
    patchProfile({
      documents_obtained: [],
      documents_response: negative === key ? null : key,
    })
  }

  return (
    <WizardLayout
      step={step}
      title={t('onboarding.steps.documents.title')}
      subtitle={t('onboarding.steps.documents.subtitle')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <div className="space-y-2">
        {ONBOARDING_DOCUMENT_KEYS.map((k) => (
          <label
            key={k}
            className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50"
          >
            <input
              type="checkbox"
              checked={docs.has(k)}
              onChange={(e) => toggleDoc(k, e.target.checked)}
              className="accent-neutral-900"
            />
            <span className="text-sm">
              {t(`onboarding.steps.documents.options.${kToOptionKey(k)}`)}
            </span>
          </label>
        ))}

        <div className="pt-2 border-t border-neutral-100" />

        {NEGATIVE_OPTIONS.map((k) => (
          <label
            key={k}
            className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50"
          >
            <input
              type="checkbox"
              checked={negative === k}
              onChange={() => setNegative(k)}
              className="accent-neutral-900"
            />
            <span className="text-sm">
              {t(`onboarding.steps.documents.options.${k}`)}
            </span>
          </label>
        ))}
      </div>

      {showNoDocsNote && (
        <p className="mt-6 text-sm text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-3 leading-relaxed">
          {t('onboarding.steps.documents.no_docs_note')}
        </p>
      )}
    </WizardLayout>
  )
}

function kToOptionKey(k: OnboardingDocumentKey): string {
  switch (k) {
    case 'court-order':
      return 'court_order'
    case 'birth-certificate':
      return 'birth_certificate'
    case 'social-security':
      return 'social_security'
    case 'photo-id':
      return 'photo_id'
  }
}
