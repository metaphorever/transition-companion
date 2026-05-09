import { useTranslation } from 'react-i18next'
import WizardLayout from './WizardLayout'
import type { StepProps } from './OnboardingWizard'
import { useAppStore } from '../../store'
import type {
  HousingStatus,
  WorkplaceSafety,
  OverallFlexibility,
  Transportation,
  UserSafety,
  UserAccess,
} from '../../types'

const HOUSING_OPTIONS: { value: HousingStatus; key: string }[] = [
  { value: 'independent', key: 'independent' },
  { value: 'living_with_family_or_others', key: 'family_or_others' },
  { value: 'transitional_or_unstable', key: 'transitional' },
  { value: 'prefer_not_to_say', key: 'prefer_not_to_say' },
]

// Privacy radio: maps to two booleans (shared_accounts, shared_devices) since
// the design model splits them, but the wizard collapses to one question.
type PrivacyKey = 'private' | 'some_shared' | 'mostly_shared' | 'prefer_not_to_say'

const PRIVACY_TO_FLAGS: Record<PrivacyKey, { shared_accounts: boolean | null; shared_devices: boolean | null }> = {
  private: { shared_accounts: false, shared_devices: false },
  some_shared: { shared_accounts: true, shared_devices: false },
  mostly_shared: { shared_accounts: true, shared_devices: true },
  prefer_not_to_say: { shared_accounts: null, shared_devices: null },
}

function deriveSafetyPrivacy(safety: UserSafety): PrivacyKey | null {
  const a = safety.shared_accounts
  const d = safety.shared_devices
  if (a === false && d === false) return 'private'
  if (a === true && d === false) return 'some_shared'
  if (a === true && d === true) return 'mostly_shared'
  if (a === null && d === null) {
    // Could be "never answered" or "prefer not to say" — both render the same
    // (no radio selected). We show no selection until user picks one.
    return null
  }
  return null
}

const WORKPLACE_OPTIONS: { value: WorkplaceSafety; key: string }[] = [
  { value: 'out_and_supported', key: 'out_supported' },
  { value: 'out_but_complicated', key: 'out_complicated' },
  { value: 'not_out_at_work', key: 'not_out' },
  { value: 'not_employed', key: 'not_employed' },
  { value: 'prefer_not_to_say', key: 'prefer_not_to_say' },
]

const FLEXIBILITY_OPTIONS: { value: OverallFlexibility; key: string }[] = [
  { value: 'a_lot', key: 'a_lot' },
  { value: 'some', key: 'some' },
  { value: 'not_much', key: 'not_much' },
  { value: 'varies', key: 'varies' },
]

const TRANSPORT_OPTIONS: { value: Transportation; key: string }[] = [
  { value: 'car', key: 'car' },
  { value: 'public_transit', key: 'public_transit' },
  { value: 'ride_share', key: 'ride_share' },
  { value: 'limited', key: 'limited' },
  { value: 'prefer_not_to_say', key: 'prefer_not_to_say' },
]

// Equipment: maps to multiple boolean fields on UserAccess. Three are
// printer-related and mutually exclusive in the UI; phone and video_call are
// independent toggles.
type PrinterKey = 'printer_home' | 'printer_nearby' | 'printer_difficult'
const PRINTER_KEYS: PrinterKey[] = ['printer_home', 'printer_nearby', 'printer_difficult']

function derivePrinter(access: UserAccess): PrinterKey | null {
  if (access.printer_home) return 'printer_home'
  if (access.printer_access) return 'printer_nearby'
  // Difficult is signalled by both being false AND the user having visited.
  // We can't easily distinguish "not answered" from "difficult" from booleans
  // alone; treat both as no selection.
  return null
}

export default function Step5Safety({ step, onBack, onSkip, onNext }: StepProps) {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const patchProfile = useAppStore((s) => s.patchProfile)

  const setHousing = (v: HousingStatus) =>
    patchProfile({ safety: { ...profile.safety, housing_status: v } })

  const setPrivacy = (v: PrivacyKey) =>
    patchProfile({ safety: { ...profile.safety, ...PRIVACY_TO_FLAGS[v] } })

  const setWorkplace = (v: WorkplaceSafety) =>
    patchProfile({ safety: { ...profile.safety, workplace_safety: v } })

  const setFlexibility = (v: OverallFlexibility) =>
    patchProfile({ safety: { ...profile.safety, overall_flexibility: v } })

  const setTransport = (v: Transportation) =>
    patchProfile({ access: { ...profile.access, transportation: v } })

  const setPrinter = (v: PrinterKey) => {
    const next: UserAccess = { ...profile.access }
    next.printer_home = v === 'printer_home'
    next.printer_access = v === 'printer_nearby'
    // 'printer_difficult' leaves both false. The selection still renders
    // because we read profile.access values back.
    patchProfile({ access: next })
  }

  const togglePhone = (b: boolean) =>
    patchProfile({ access: { ...profile.access, phone_reliable: b } })

  const toggleVideo = (b: boolean) =>
    patchProfile({ access: { ...profile.access, video_call_capable: b } })

  const privacy = deriveSafetyPrivacy(profile.safety)
  const printer = derivePrinter(profile.access)

  return (
    <WizardLayout
      step={step}
      title={t('onboarding.steps.safety.title')}
      subtitle={t('onboarding.steps.safety.subtitle')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <div className="space-y-8">
        <RadioGroup
          label={t('onboarding.steps.safety.housing_label')}
          options={HOUSING_OPTIONS.map((o) => ({
            value: o.value,
            label: t(`onboarding.steps.safety.housing_options.${o.key}`),
          }))}
          value={profile.safety.housing_status}
          onChange={(v) => setHousing(v as HousingStatus)}
        />

        <RadioGroup
          label={t('onboarding.steps.safety.privacy_label')}
          options={(['private', 'some_shared', 'mostly_shared', 'prefer_not_to_say'] as PrivacyKey[]).map(
            (k) => ({
              value: k,
              label: t(`onboarding.steps.safety.privacy_options.${k}`),
            })
          )}
          value={privacy}
          onChange={(v) => setPrivacy(v as PrivacyKey)}
        />

        <RadioGroup
          label={t('onboarding.steps.safety.workplace_label')}
          options={WORKPLACE_OPTIONS.map((o) => ({
            value: o.value,
            label: t(`onboarding.steps.safety.workplace_options.${o.key}`),
          }))}
          value={profile.safety.workplace_safety}
          onChange={(v) => setWorkplace(v as WorkplaceSafety)}
        />

        <RadioGroup
          label={t('onboarding.steps.safety.flexibility_label')}
          options={FLEXIBILITY_OPTIONS.map((o) => ({
            value: o.value,
            label: t(`onboarding.steps.safety.flexibility_options.${o.key}`),
          }))}
          value={profile.safety.overall_flexibility}
          onChange={(v) => setFlexibility(v as OverallFlexibility)}
        />

        <RadioGroup
          label={t('onboarding.steps.safety.transportation_label')}
          options={TRANSPORT_OPTIONS.map((o) => ({
            value: o.value,
            label: t(`onboarding.steps.safety.transportation_options.${o.key}`),
          }))}
          value={profile.access.transportation}
          onChange={(v) => setTransport(v as Transportation)}
        />

        <div>
          <p className="block text-sm font-medium text-neutral-800 mb-2">
            {t('onboarding.steps.safety.equipment_label')}
          </p>
          <div role="radiogroup" className="space-y-2">
            {PRINTER_KEYS.map((k) => (
              <label
                key={k}
                className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50"
              >
                <input
                  type="radio"
                  name="printer-access"
                  checked={printer === k}
                  onChange={() => setPrinter(k)}
                  className="accent-neutral-900"
                />
                <span className="text-sm">
                  {t(`onboarding.steps.safety.equipment_options.${k}`)}
                </span>
              </label>
            ))}
            <label className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={profile.access.phone_reliable}
                onChange={(e) => togglePhone(e.target.checked)}
                className="accent-neutral-900"
              />
              <span className="text-sm">
                {t('onboarding.steps.safety.equipment_options.phone')}
              </span>
            </label>
            <label className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={profile.access.video_call_capable}
                onChange={(e) => toggleVideo(e.target.checked)}
                className="accent-neutral-900"
              />
              <span className="text-sm">
                {t('onboarding.steps.safety.equipment_options.video_call')}
              </span>
            </label>
          </div>
        </div>

        <p className="text-sm text-neutral-600 leading-relaxed italic">
          {t('onboarding.steps.safety.footer_note')}
        </p>
      </div>
    </WizardLayout>
  )
}

interface RadioGroupProps {
  label: string
  options: { value: string; label: string }[]
  value: string | null
  onChange: (value: string) => void
}

function RadioGroup({ label, options, value, onChange }: RadioGroupProps) {
  // Use a unique name per group so the browser doesn't link separate radio
  // groups together when this component renders multiple times in one form.
  const groupName = `radio-${label.replace(/\s+/g, '-').toLowerCase()}`
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
