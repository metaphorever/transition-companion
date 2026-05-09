import { useTranslation } from 'react-i18next'
import WizardLayout from './WizardLayout'
import type { StepProps } from './OnboardingWizard'
import { useAppStore } from '../../store'
import type { PresenceLevel } from '../../types'

const PRESENCE_LEVELS: PresenceLevel[] = ['just_the_path', 'some_guidance', 'walk_with_me']

export default function Step6Presence({ step, onBack, onSkip, onNext }: StepProps) {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const patchProfile = useAppStore((s) => s.patchProfile)

  const setLevel = (level: PresenceLevel) =>
    patchProfile({ presence: { ...profile.presence, overall_level: level } })

  const setOpenDoors = (b: boolean) =>
    patchProfile({ presence: { ...profile.presence, open_doors: b } })

  return (
    <WizardLayout
      step={step}
      title={t('onboarding.steps.presence.title')}
      subtitle={t('onboarding.steps.presence.subtitle')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <div className="space-y-8">
        <div>
          <p className="block text-sm font-medium text-neutral-800 mb-3">
            {t('onboarding.steps.presence.level_label')}
          </p>
          <div role="radiogroup" className="space-y-3">
            {PRESENCE_LEVELS.map((level) => {
              const checked = profile.presence.overall_level === level
              return (
                <label
                  key={level}
                  className={`block px-4 py-3 border rounded-md cursor-pointer transition-colors ${
                    checked
                      ? 'border-neutral-900 bg-neutral-50'
                      : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="presence-level"
                      checked={checked}
                      onChange={() => setLevel(level)}
                      className="mt-1 accent-neutral-900"
                    />
                    <div>
                      <div className="text-sm font-medium text-neutral-900">
                        {t(`onboarding.steps.presence.levels.${level}.label`)}
                      </div>
                      <div className="text-sm text-neutral-600 mt-1 leading-relaxed">
                        {t(`onboarding.steps.presence.levels.${level}.description`)}
                      </div>
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
          <p className="text-xs text-neutral-500 mt-3 italic">
            {t('onboarding.steps.presence.level_note')}
          </p>
        </div>

        <div>
          <p className="block text-sm font-medium text-neutral-800 mb-2">
            {t('onboarding.steps.presence.open_doors_label')}
          </p>
          <div role="radiogroup" className="space-y-2">
            <label className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50">
              <input
                type="radio"
                name="open-doors"
                checked={profile.presence.open_doors === true}
                onChange={() => setOpenDoors(true)}
                className="accent-neutral-900"
              />
              <span className="text-sm">
                {t('onboarding.steps.presence.open_doors_yes')}
              </span>
            </label>
            <label className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50">
              <input
                type="radio"
                name="open-doors"
                checked={profile.presence.open_doors === false}
                onChange={() => setOpenDoors(false)}
                className="accent-neutral-900"
              />
              <span className="text-sm">
                {t('onboarding.steps.presence.open_doors_no')}
              </span>
            </label>
          </div>
        </div>

        <p className="text-xs text-neutral-500 leading-relaxed">
          {t('onboarding.steps.presence.per_track_note')}
        </p>
      </div>
    </WizardLayout>
  )
}
