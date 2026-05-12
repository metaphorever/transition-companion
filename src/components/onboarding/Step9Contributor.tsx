import { useTranslation } from 'react-i18next'
import WizardLayout from './WizardLayout'
import type { StepProps } from './OnboardingWizard'
import { useAppStore } from '../../store'
import type {
  ContributorPrivacyLevel,
  ContributorPromptingLevel,
  ContributorInvolvementLevel,
} from '../../types'

const PRIVACY_OPTIONS: ContributorPrivacyLevel[] = ['manual', 'always_include', 'never_include']
const PROMPTING_OPTIONS: ContributorPromptingLevel[] = ['contextual', 'proactive', 'off']
const INVOLVEMENT_OPTIONS: ContributorInvolvementLevel[] = ['observer', 'reporter', 'contributor']

export default function Step9Contributor({ step, onBack, onSkip, onNext }: StepProps) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.userData.profile.contributor_settings)
  const patchProfile = useAppStore((s) => s.patchProfile)

  const update = (patch: Partial<typeof settings>) =>
    patchProfile({ contributor_settings: { ...settings, ...patch } })

  return (
    <WizardLayout
      step={step}
      title={t('onboarding.steps.contributor.title')}
      subtitle={t('onboarding.steps.contributor.subtitle')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <div className="space-y-8">
        <DialGroup
          label={t('onboarding.steps.contributor.privacy_label')}
          options={PRIVACY_OPTIONS.map((v) => ({
            value: v,
            label: t(`onboarding.steps.contributor.privacy_options.${v}`),
          }))}
          value={settings.privacy_level}
          onChange={(v) => update({ privacy_level: v as ContributorPrivacyLevel })}
        />
        <DialGroup
          label={t('onboarding.steps.contributor.prompting_label')}
          options={PROMPTING_OPTIONS.map((v) => ({
            value: v,
            label: t(`onboarding.steps.contributor.prompting_options.${v}`),
          }))}
          value={settings.prompting_level}
          onChange={(v) => update({ prompting_level: v as ContributorPromptingLevel })}
        />
        <DialGroup
          label={t('onboarding.steps.contributor.involvement_label')}
          options={INVOLVEMENT_OPTIONS.map((v) => ({
            value: v,
            label: t(`onboarding.steps.contributor.involvement_options.${v}`),
          }))}
          value={settings.involvement_level}
          onChange={(v) => update({ involvement_level: v as ContributorInvolvementLevel })}
        />
      </div>
    </WizardLayout>
  )
}

interface DialGroupProps {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}

function DialGroup({ label, options, value, onChange }: DialGroupProps) {
  const groupName = `dial-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div>
      <p className="block text-sm font-medium text-neutral-800 mb-2">{label}</p>
      <div role="radiogroup" className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50"
          >
            <input
              type="radio"
              name={groupName}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-neutral-900"
            />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
