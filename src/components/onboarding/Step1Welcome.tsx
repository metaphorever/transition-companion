import { useTranslation } from 'react-i18next'
import WizardLayout from './WizardLayout'
import type { StepProps } from './OnboardingWizard'

export default function Step1Welcome({ step, onNext }: StepProps) {
  const { t } = useTranslation()

  // Welcome has no back button (first step), no skip button (the welcome
  // itself is the entire screen — there is nothing to skip past), and the
  // primary action is just "Next" with no commitment yet.
  return (
    <WizardLayout step={step} bareHeader onNext={onNext}>
      <div className="pt-12 pb-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-6">
          {t('app.name')}
        </p>
        <h1 className="text-3xl font-semibold leading-tight mb-6">
          {t('onboarding.steps.welcome.title')}
        </h1>
        <p className="text-base text-neutral-700 leading-relaxed mb-4">
          {t('onboarding.steps.welcome.body')}
        </p>
        <p className="text-sm text-neutral-500">
          {t('onboarding.steps.welcome.subtitle')}
        </p>
      </div>
    </WizardLayout>
  )
}
