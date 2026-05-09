import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import WizardLayout from './WizardLayout'
import type { StepProps } from './OnboardingWizard'
import { useAppStore } from '../../store'

// The six "What are you here for?" options the wizard surfaces. Each maps to
// some combination of profile.change_types and profile.active_tracks. The
// mapping is centralized here so that ticking and unticking are inverses.
type HereForKey = 'legal_name' | 'gender_marker' | 'medical' | 'social' | 'supporting' | 'exploring'

const HERE_FOR_KEYS: readonly HereForKey[] = [
  'legal_name',
  'gender_marker',
  'medical',
  'social',
  'supporting',
  'exploring',
]

const PRONOUN_OPTIONS = [
  'she_her',
  'he_him',
  'they_them',
  'she_they',
  'he_they',
  'custom',
  'prefer_not_to_say',
  'not_sure_yet',
] as const

type PronounOption = (typeof PRONOUN_OPTIONS)[number]

const PRONOUN_TEXT: Record<Exclude<PronounOption, 'custom'>, string> = {
  she_her: 'she/her',
  he_him: 'he/him',
  they_them: 'they/them',
  she_they: 'she/they',
  he_they: 'he/they',
  prefer_not_to_say: '',
  not_sure_yet: '',
}

function pronounsToOption(stored: string | null): PronounOption | null {
  if (stored === null) return null
  for (const [key, text] of Object.entries(PRONOUN_TEXT)) {
    if (text && text === stored) return key as PronounOption
  }
  if (stored === 'prefer_not_to_say' || stored === 'not_sure_yet') return stored
  return 'custom'
}

// Profile state → set of currently-checked here_for keys.
function deriveHereFor(changeTypes: string[], activeTracks: string[]): Set<HereForKey> {
  const set = new Set<HereForKey>()
  if (changeTypes.includes('name')) set.add('legal_name')
  if (changeTypes.includes('gender_marker')) set.add('gender_marker')
  if (activeTracks.includes('medical')) set.add('medical')
  if (activeTracks.includes('social')) set.add('social')
  if (activeTracks.includes('supporter')) set.add('supporting')
  if (activeTracks.includes('personal')) set.add('exploring')
  return set
}

// here_for set → patches for change_types and active_tracks.
// 'legal' is added when either name or gender marker is checked, and removed
// only when neither is.
function applyHereForToProfile(
  selected: Set<HereForKey>
): { change_types: string[]; active_tracks: string[] } {
  const change_types: string[] = []
  if (selected.has('legal_name')) change_types.push('name')
  if (selected.has('gender_marker')) change_types.push('gender_marker')

  const active_tracks: string[] = []
  if (selected.has('legal_name') || selected.has('gender_marker')) active_tracks.push('legal')
  if (selected.has('medical')) active_tracks.push('medical')
  if (selected.has('social')) active_tracks.push('social')
  if (selected.has('supporting')) active_tracks.push('supporter')
  if (selected.has('exploring')) active_tracks.push('personal')

  return { change_types, active_tracks }
}

export default function Step2AboutYou({ step, onBack, onSkip, onNext }: StepProps) {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const patchProfile = useAppStore((s) => s.patchProfile)

  const hereFor = useMemo(
    () => deriveHereFor(profile.change_types, profile.active_tracks),
    [profile.change_types, profile.active_tracks]
  )
  const pronounOption = pronounsToOption(profile.pronouns)
  const showCustomPronouns = pronounOption === 'custom'
  const showGenderMarkerTarget = hereFor.has('gender_marker')

  const handleName = (value: string) => {
    const trimmed = value.length > 0 ? value : null
    patchProfile({ display_name: trimmed, chosen_name: trimmed })
  }

  const handlePronounChoice = (option: PronounOption) => {
    if (option === 'custom') {
      patchProfile({ pronouns: profile.pronouns_other ?? '', pronouns_other: profile.pronouns_other ?? '' })
      // Note: pronouns is set to the typed value (or empty if none yet) so
      // that round-tripping `pronounsToOption` keeps "custom" selected.
      // We rely on the empty string mapping to "custom" because it isn't in
      // the preset list.
      return
    }
    if (option === 'prefer_not_to_say' || option === 'not_sure_yet') {
      patchProfile({ pronouns: option, pronouns_other: null })
      return
    }
    patchProfile({ pronouns: PRONOUN_TEXT[option], pronouns_other: null })
  }

  const handleCustomPronounsText = (value: string) => {
    patchProfile({ pronouns: value, pronouns_other: value })
  }

  const handleHereForToggle = (key: HereForKey, checked: boolean) => {
    const next = new Set(hereFor)
    if (checked) next.add(key)
    else next.delete(key)
    patchProfile(applyHereForToProfile(next))
  }

  const handleGenderMarkerTarget = (value: string) => {
    patchProfile({ gender_marker_target: value.length > 0 ? value : null })
  }

  return (
    <WizardLayout
      step={step}
      title={t('onboarding.steps.about_you.title')}
      subtitle={t('onboarding.steps.about_you.subtitle')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <div className="space-y-8">
        <Field
          label={t('onboarding.steps.about_you.name_label')}
          htmlFor="about-name"
        >
          <input
            id="about-name"
            type="text"
            value={profile.display_name ?? ''}
            onChange={(e) => handleName(e.target.value)}
            placeholder={t('onboarding.steps.about_you.name_placeholder')}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
          />
        </Field>

        <Field label={t('onboarding.steps.about_you.pronouns_label')}>
          <div role="radiogroup" className="space-y-2">
            {PRONOUN_OPTIONS.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50"
              >
                <input
                  type="radio"
                  name="pronouns"
                  value={opt}
                  checked={pronounOption === opt}
                  onChange={() => handlePronounChoice(opt)}
                  className="accent-neutral-900"
                />
                <span className="text-sm">
                  {t(`onboarding.steps.about_you.pronouns_options.${opt}`)}
                </span>
              </label>
            ))}
          </div>
          {showCustomPronouns && (
            <input
              type="text"
              autoFocus
              value={profile.pronouns_other ?? ''}
              onChange={(e) => handleCustomPronounsText(e.target.value)}
              placeholder="Type your pronouns"
              aria-label="Your pronouns"
              className="mt-3 w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
            />
          )}
        </Field>

        <Field
          label={t('onboarding.steps.about_you.here_for_label')}
          help={t('onboarding.steps.about_you.here_for_note')}
        >
          <div className="space-y-2">
            {HERE_FOR_KEYS.map((key) => {
              const checked = hereFor.has(key)
              return (
                <label
                  key={key}
                  className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => handleHereForToggle(key, e.target.checked)}
                    className="accent-neutral-900"
                  />
                  <span className="text-sm">
                    {t(`onboarding.steps.about_you.here_for_options.${key}`)}
                  </span>
                </label>
              )
            })}
          </div>
        </Field>

        {showGenderMarkerTarget && (
          <Field
            label={t('onboarding.steps.about_you.gender_marker_target_label')}
            htmlFor="gender-marker-target"
          >
            <input
              id="gender-marker-target"
              type="text"
              value={profile.gender_marker_target ?? ''}
              onChange={(e) => handleGenderMarkerTarget(e.target.value)}
              placeholder={t('onboarding.steps.about_you.gender_marker_target_placeholder')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
            />
          </Field>
        )}
      </div>
    </WizardLayout>
  )
}

function Field({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string
  htmlFor?: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-neutral-800 mb-1"
      >
        {label}
      </label>
      {help && <p className="text-xs text-neutral-500 mb-2">{help}</p>}
      <div className="mt-2">{children}</div>
    </div>
  )
}
