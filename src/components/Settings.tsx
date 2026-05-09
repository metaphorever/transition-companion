import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import {
  useRef,
  useEffect,
  useState,
  useMemo,
  type ChangeEvent,
} from 'react'
import { useAppStore } from '../store'
import { COUNTRIES, getRegionsForCountry, getCountryLabel } from '../utils/locations'
import { ONBOARDING_DOCUMENT_KEYS, type OnboardingDocumentKey } from '../utils/onboarding'
import type {
  HousingStatus,
  WorkplaceSafety,
  OverallFlexibility,
  Transportation,
  UserSafety,
  UserAccess,
  PresenceLevel,
  ContributorPrivacyLevel,
  ContributorPromptingLevel,
  ContributorInvolvementLevel,
} from '../types'

// ── Shared primitives ─────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
        {title}
      </h2>
      <div className="space-y-6">{children}</div>
    </section>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-neutral-800 mb-2"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

interface RadioGroupProps {
  label: string
  options: { value: string; label: string }[]
  value: string | null
  onChange: (value: string) => void
  groupId: string
}

function RadioGroup({ label, options, value, onChange, groupId }: RadioGroupProps) {
  return (
    <Field label={label}>
      <div role="radiogroup" className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50"
          >
            <input
              type="radio"
              name={groupId}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-neutral-900"
            />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </div>
    </Field>
  )
}

// ── Pronoun helpers (mirrors Step2AboutYou) ───────────────────────────────────

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
  if (stored === 'prefer_not_to_say' || stored === 'not_sure_yet') return stored as PronounOption
  return 'custom'
}

type HereForKey = 'legal_name' | 'gender_marker' | 'medical' | 'social' | 'supporting' | 'exploring'

const HERE_FOR_KEYS: readonly HereForKey[] = [
  'legal_name',
  'gender_marker',
  'medical',
  'social',
  'supporting',
  'exploring',
]

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

function applyHereForToProfile(selected: Set<HereForKey>): {
  change_types: string[]
  active_tracks: string[]
} {
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

// ── Privacy helper (mirrors Step5Safety) ─────────────────────────────────────

type PrivacyKey = 'private' | 'some_shared' | 'mostly_shared' | 'prefer_not_to_say'

const PRIVACY_TO_FLAGS: Record<
  PrivacyKey,
  { shared_accounts: boolean | null; shared_devices: boolean | null }
> = {
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
  return null
}

type PrinterKey = 'printer_home' | 'printer_nearby' | 'printer_difficult'

function derivePrinter(access: UserAccess): PrinterKey | null {
  if (access.printer_home) return 'printer_home'
  if (access.printer_access) return 'printer_nearby'
  return null
}

function docKeyToOptionKey(k: OnboardingDocumentKey): string {
  switch (k) {
    case 'court-order': return 'court_order'
    case 'birth-certificate': return 'birth_certificate'
    case 'social-security': return 'social_security'
    case 'photo-id': return 'photo_id'
  }
}

// ── Profile section ───────────────────────────────────────────────────────────

function ProfileSection() {
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
    <Section title={t('settings.section_profile')}>
      <Field label={t('onboarding.steps.about_you.name_label')} htmlFor="settings-name">
        <input
          id="settings-name"
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
                name="settings-pronouns"
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
            value={profile.pronouns_other ?? ''}
            onChange={(e) => handleCustomPronounsText(e.target.value)}
            placeholder="Type your pronouns"
            aria-label="Your pronouns"
            className="mt-3 w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
          />
        )}
      </Field>

      <Field label={t('onboarding.steps.about_you.here_for_label')}>
        <p className="text-xs text-neutral-500 mb-2">
          {t('onboarding.steps.about_you.here_for_note')}
        </p>
        <div className="space-y-2">
          {HERE_FOR_KEYS.map((key) => (
            <label
              key={key}
              className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50"
            >
              <input
                type="checkbox"
                checked={hereFor.has(key)}
                onChange={(e) => handleHereForToggle(key, e.target.checked)}
                className="accent-neutral-900"
              />
              <span className="text-sm">
                {t(`onboarding.steps.about_you.here_for_options.${key}`)}
              </span>
            </label>
          ))}
        </div>
      </Field>

      {showGenderMarkerTarget && (
        <Field
          label={t('onboarding.steps.about_you.gender_marker_target_label')}
          htmlFor="settings-gmt"
        >
          <input
            id="settings-gmt"
            type="text"
            value={profile.gender_marker_target ?? ''}
            onChange={(e) => handleGenderMarkerTarget(e.target.value)}
            placeholder={t('onboarding.steps.about_you.gender_marker_target_placeholder')}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
          />
        </Field>
      )}
    </Section>
  )
}

// ── Location section ──────────────────────────────────────────────────────────

interface CountryComboboxProps {
  value: string | null
  onChange: (code: string | null) => void
  placeholder: string
}

function CountryCombobox({ value, onChange, placeholder }: CountryComboboxProps) {
  const [query, setQuery] = useState(getCountryLabel(value) ?? '')
  const [trackedValue, setTrackedValue] = useState(value)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  if (value !== trackedValue) {
    setTrackedValue(value)
    setQuery(getCountryLabel(value) ?? '')
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES.slice(0, 12)
    return COUNTRIES.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 30)
  }, [query])

  const select = (code: string, label: string) => {
    onChange(code)
    setQuery(label)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id="settings-country"
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (e.target.value.trim() === '') onChange(null)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 w-full max-h-64 overflow-auto bg-white border border-neutral-200 rounded-md shadow-sm"
        >
          {filtered.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                role="option"
                aria-selected={c.code === value}
                onClick={() => select(c.code, c.label)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 ${
                  c.code === value ? 'bg-neutral-100 font-medium' : ''
                }`}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LocationSection() {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const patchProfile = useAppStore((s) => s.patchProfile)

  const country = profile.jurisdiction.country
  const region = profile.jurisdiction.region
  const regions = useMemo(() => getRegionsForCountry(country), [country])

  return (
    <Section title={t('settings.section_location')}>
      <Field label={t('onboarding.steps.location.country_label')} htmlFor="settings-country">
        <CountryCombobox
          value={country}
          onChange={(code) => patchProfile({ jurisdiction: { country: code, region: null } })}
          placeholder={t('onboarding.steps.location.country_placeholder')}
        />
      </Field>

      {country && (
        <Field label={t('onboarding.steps.location.region_label')} htmlFor="settings-region">
          {regions ? (
            <select
              id="settings-region"
              value={region ?? ''}
              onChange={(e) =>
                patchProfile({ jurisdiction: { country, region: e.target.value || null } })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm bg-white"
            >
              <option value="">{t('onboarding.steps.location.region_placeholder')}</option>
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="settings-region"
              type="text"
              value={region ?? ''}
              onChange={(e) =>
                patchProfile({ jurisdiction: { country, region: e.target.value || null } })
              }
              placeholder={t('onboarding.steps.location.region_placeholder')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
            />
          )}
        </Field>
      )}
    </Section>
  )
}

// ── Documents section ─────────────────────────────────────────────────────────

function DocumentsSection() {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const patchProfile = useAppStore((s) => s.patchProfile)

  const docs = useMemo(
    () => new Set(profile.documents_obtained as OnboardingDocumentKey[]),
    [profile.documents_obtained]
  )
  const negative = profile.documents_response

  const toggleDoc = (key: OnboardingDocumentKey, checked: boolean) => {
    const next = new Set(docs)
    if (checked) next.add(key)
    else next.delete(key)
    patchProfile({
      documents_obtained: Array.from(next),
      documents_response: checked ? null : negative,
    })
  }

  const setNegative = (key: 'none' | 'not_sure') => {
    patchProfile({
      documents_obtained: [],
      documents_response: negative === key ? null : key,
    })
  }

  return (
    <Section title={t('settings.section_documents')}>
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
              {t(`onboarding.steps.documents.options.${docKeyToOptionKey(k)}`)}
            </span>
          </label>
        ))}
        <div className="border-t border-neutral-100 pt-2" />
        {(['none', 'not_sure'] as const).map((k) => (
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
    </Section>
  )
}

// ── Safety and access section ─────────────────────────────────────────────────

const HOUSING_OPTIONS: { value: HousingStatus; key: string }[] = [
  { value: 'independent', key: 'independent' },
  { value: 'living_with_family_or_others', key: 'family_or_others' },
  { value: 'transitional_or_unstable', key: 'transitional' },
  { value: 'prefer_not_to_say', key: 'prefer_not_to_say' },
]

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

const PRINTER_KEYS: PrinterKey[] = ['printer_home', 'printer_nearby', 'printer_difficult']

function SafetySection() {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const patchProfile = useAppStore((s) => s.patchProfile)

  const privacy = deriveSafetyPrivacy(profile.safety)
  const printer = derivePrinter(profile.access)

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
    patchProfile({ access: next })
  }

  return (
    <Section title={t('settings.section_safety')}>
      <RadioGroup
        label={t('onboarding.steps.safety.housing_label')}
        groupId="settings-housing"
        options={HOUSING_OPTIONS.map((o) => ({
          value: o.value,
          label: t(`onboarding.steps.safety.housing_options.${o.key}`),
        }))}
        value={profile.safety.housing_status}
        onChange={(v) => setHousing(v as HousingStatus)}
      />

      <RadioGroup
        label={t('onboarding.steps.safety.privacy_label')}
        groupId="settings-privacy"
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
        groupId="settings-workplace"
        options={WORKPLACE_OPTIONS.map((o) => ({
          value: o.value,
          label: t(`onboarding.steps.safety.workplace_options.${o.key}`),
        }))}
        value={profile.safety.workplace_safety}
        onChange={(v) => setWorkplace(v as WorkplaceSafety)}
      />

      <RadioGroup
        label={t('onboarding.steps.safety.flexibility_label')}
        groupId="settings-flexibility"
        options={FLEXIBILITY_OPTIONS.map((o) => ({
          value: o.value,
          label: t(`onboarding.steps.safety.flexibility_options.${o.key}`),
        }))}
        value={profile.safety.overall_flexibility}
        onChange={(v) => setFlexibility(v as OverallFlexibility)}
      />

      <RadioGroup
        label={t('onboarding.steps.safety.transportation_label')}
        groupId="settings-transport"
        options={TRANSPORT_OPTIONS.map((o) => ({
          value: o.value,
          label: t(`onboarding.steps.safety.transportation_options.${o.key}`),
        }))}
        value={profile.access.transportation}
        onChange={(v) => setTransport(v as Transportation)}
      />

      <Field label={t('onboarding.steps.safety.equipment_label')}>
        <div role="radiogroup" className="space-y-2">
          {PRINTER_KEYS.map((k) => (
            <label
              key={k}
              className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50"
            >
              <input
                type="radio"
                name="settings-printer"
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
              onChange={(e) =>
                patchProfile({ access: { ...profile.access, phone_reliable: e.target.checked } })
              }
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
              onChange={(e) =>
                patchProfile({ access: { ...profile.access, video_call_capable: e.target.checked } })
              }
              className="accent-neutral-900"
            />
            <span className="text-sm">
              {t('onboarding.steps.safety.equipment_options.video_call')}
            </span>
          </label>
        </div>
      </Field>
    </Section>
  )
}

// ── Presence level section ────────────────────────────────────────────────────

const PRESENCE_LEVELS: PresenceLevel[] = ['just_the_path', 'some_guidance', 'walk_with_me']
const SETTINGS_TRACKS = ['legal', 'medical', 'social', 'personal', 'supporter'] as const

function PresenceSection() {
  const { t } = useTranslation()
  const presence = useAppStore((s) => s.userData.profile.presence)
  const patchProfile = useAppStore((s) => s.patchProfile)

  function setPerTrack(track: string, value: string) {
    const updated = { ...presence.per_track }
    if (value === '') {
      delete updated[track]
    } else {
      updated[track] = value as PresenceLevel
    }
    patchProfile({ presence: { ...presence, per_track: updated } })
  }

  return (
    <Section title={t('settings.section_presence')}>
      <RadioGroup
        label={t('onboarding.steps.presence.level_label')}
        groupId="settings-presence"
        options={PRESENCE_LEVELS.map((v) => ({
          value: v,
          label: t(`onboarding.steps.presence.levels.${v}.label`),
        }))}
        value={presence.overall_level}
        onChange={(v) =>
          patchProfile({ presence: { ...presence, overall_level: v as PresenceLevel } })
        }
      />

      <Field label={t('onboarding.steps.presence.open_doors_label')}>
        <div className="space-y-2">
          {[
            { value: 'yes', label: t('onboarding.steps.presence.open_doors_yes'), checked: presence.open_doors },
            { value: 'no', label: t('onboarding.steps.presence.open_doors_no'), checked: !presence.open_doors },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-3 px-3 py-2 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50"
            >
              <input
                type="radio"
                name="settings-open-doors"
                checked={opt.checked}
                onChange={() =>
                  patchProfile({ presence: { ...presence, open_doors: opt.value === 'yes' } })
                }
                className="accent-neutral-900"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label={t('settings.presence_per_track_heading')}>
        <div className="space-y-2">
          {SETTINGS_TRACKS.map((track) => (
            <div key={track} className="flex items-center justify-between gap-4">
              <span className="text-sm text-neutral-700 capitalize">
                {t(`dashboard.tracks.${track}`)}
              </span>
              <select
                value={presence.per_track[track] ?? ''}
                onChange={(e) => setPerTrack(track, e.target.value)}
                className="text-sm border border-neutral-300 rounded px-2 py-1 bg-white text-neutral-700 focus:outline-none focus:border-neutral-600"
              >
                <option value="">{t('settings.presence_per_track_default')}</option>
                {PRESENCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {t(`onboarding.steps.presence.levels.${level}.label`)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </Field>
    </Section>
  )
}

// ── Contributor settings section ──────────────────────────────────────────────

function ContributorSection() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.userData.profile.contributor_settings)
  const patchProfile = useAppStore((s) => s.patchProfile)

  const update = (patch: Partial<typeof settings>) =>
    patchProfile({ contributor_settings: { ...settings, ...patch } })

  const PRIVACY_OPTIONS: ContributorPrivacyLevel[] = ['manual', 'always_include', 'never_include']
  const PROMPTING_OPTIONS: ContributorPromptingLevel[] = ['contextual', 'proactive', 'off']
  const INVOLVEMENT_OPTIONS: ContributorInvolvementLevel[] = ['observer', 'reporter', 'contributor']

  return (
    <Section title={t('settings.section_contributor')}>
      <RadioGroup
        label={t('onboarding.steps.contributor.privacy_label')}
        groupId="settings-contrib-privacy"
        options={PRIVACY_OPTIONS.map((v) => ({
          value: v,
          label: t(`onboarding.steps.contributor.privacy_options.${v}`),
        }))}
        value={settings.privacy_level}
        onChange={(v) => update({ privacy_level: v as ContributorPrivacyLevel })}
      />
      <RadioGroup
        label={t('onboarding.steps.contributor.prompting_label')}
        groupId="settings-contrib-prompting"
        options={PROMPTING_OPTIONS.map((v) => ({
          value: v,
          label: t(`onboarding.steps.contributor.prompting_options.${v}`),
        }))}
        value={settings.prompting_level}
        onChange={(v) => update({ prompting_level: v as ContributorPromptingLevel })}
      />
      <RadioGroup
        label={t('onboarding.steps.contributor.involvement_label')}
        groupId="settings-contrib-involvement"
        options={INVOLVEMENT_OPTIONS.map((v) => ({
          value: v,
          label: t(`onboarding.steps.contributor.involvement_options.${v}`),
        }))}
        value={settings.involvement_level}
        onChange={(v) => update({ involvement_level: v as ContributorInvolvementLevel })}
      />
    </Section>
  )
}

// ── People section ────────────────────────────────────────────────────────────

function PeopleSection() {
  const { t } = useTranslation()
  return (
    <Section title={t('settings.section_people')}>
      <Link
        to="/people"
        className="inline-block text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
      >
        {t('settings.people_map_link')}
      </Link>
    </Section>
  )
}

// ── Knowledge base section ────────────────────────────────────────────────────

function KBSection() {
  const { t } = useTranslation()
  const kb = useAppStore((s) => s.kb)
  const kbLoading = useAppStore((s) => s.kbLoading)
  const forceRefreshKB = useAppStore((s) => s.forceRefreshKB)

  const lastUpdated = kb?.fetched_at
    ? new Date(kb.fetched_at).toLocaleDateString()
    : null

  return (
    <Section title={t('settings.section_kb')}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-neutral-600">
          {lastUpdated
            ? t('settings.kb_last_updated', { date: lastUpdated })
            : t('settings.kb_never_loaded')}
        </p>
        <button
          type="button"
          onClick={forceRefreshKB}
          disabled={kbLoading}
          className="text-sm px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {kbLoading ? t('settings.kb_refreshing') : t('settings.kb_refresh')}
        </button>
      </div>
    </Section>
  )
}

// ── Data management section ───────────────────────────────────────────────────

type ImportState =
  | { phase: 'idle' }
  | { phase: 'confirm'; text: string }
  | { phase: 'success' }
  | { phase: 'error'; message: string }

type ClearState = 'idle' | 'warn' | 'confirm'

function DataSection({ autoOpen }: { autoOpen: boolean }) {
  const { t } = useTranslation()
  const exportData = useAppStore((s) => s.exportData)
  const importData = useAppStore((s) => s.importData)
  const clearData = useAppStore((s) => s.clearData)

  const [importState, setImportState] = useState<ImportState>({ phase: 'idle' })
  const [clearState, setClearState] = useState<ClearState>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoOpen) {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [autoOpen])

  const handleExport = () => {
    const json = exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date().toISOString().split('T')[0]
    a.download = `transition-companion-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setImportState({ phase: 'confirm', text })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImportConfirm = () => {
    if (importState.phase !== 'confirm') return
    const result = importData(importState.text)
    if (result.ok) {
      setImportState({ phase: 'success' })
      setTimeout(() => setImportState({ phase: 'idle' }), 3000)
    } else {
      setImportState({ phase: 'error', message: result.error ?? 'Import failed.' })
    }
  }

  const handleClearFinal = () => {
    clearData()
    setClearState('idle')
  }

  return (
    <Section title={t('settings.section_data')}>
      <div ref={sectionRef} className="space-y-4">
        {/* Export */}
        <div className="flex items-center justify-between gap-4 py-3 border-b border-neutral-100">
          <p className="text-sm text-neutral-700">{t('settings.export')}</p>
          <button
            type="button"
            onClick={handleExport}
            className="text-sm px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50"
          >
            {t('settings.export')}
          </button>
        </div>

        {/* Import */}
        <div className="py-3 border-b border-neutral-100">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-neutral-700">{t('settings.import')}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50"
            >
              {t('settings.import_file_label')}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />

          {importState.phase === 'confirm' && (
            <div className="mt-3 p-3 bg-neutral-50 border border-neutral-200 rounded-md space-y-3">
              <p className="text-sm text-neutral-700">{t('settings.import_confirm')}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleImportConfirm}
                  className="text-sm px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-700"
                >
                  {t('settings.import')}
                </button>
                <button
                  type="button"
                  onClick={() => setImportState({ phase: 'idle' })}
                  className="text-sm px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50"
                >
                  {t('settings.import_cancel')}
                </button>
              </div>
            </div>
          )}

          {importState.phase === 'success' && (
            <p className="mt-2 text-sm text-neutral-600">{t('settings.import_success')}</p>
          )}

          {importState.phase === 'error' && (
            <p className="mt-2 text-sm text-red-600">{importState.message}</p>
          )}
        </div>

        {/* Clear */}
        <div className="py-3">
          {clearState === 'idle' && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-neutral-700">{t('settings.clear')}</p>
              <button
                type="button"
                onClick={() => setClearState('warn')}
                className="text-sm px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50"
              >
                {t('settings.clear')}
              </button>
            </div>
          )}

          {clearState === 'warn' && (
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md space-y-3">
              <p className="text-sm text-neutral-700">{t('settings.clear_warning')}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="text-sm px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50"
                >
                  {t('settings.export')}
                </button>
                <button
                  type="button"
                  onClick={() => setClearState('confirm')}
                  className="text-sm px-4 py-2 text-red-700 border border-red-200 rounded-md hover:bg-red-50"
                >
                  {t('settings.clear_confirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setClearState('idle')}
                  className="text-sm px-4 py-2 text-neutral-500 hover:text-neutral-700"
                >
                  {t('settings.clear_cancel')}
                </button>
              </div>
            </div>
          )}

          {clearState === 'confirm' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md space-y-3">
              <p className="text-sm text-red-800 font-medium">{t('settings.clear_warning')}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearFinal}
                  className="text-sm px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800"
                >
                  {t('settings.clear_confirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setClearState('idle')}
                  className="text-sm px-4 py-2 text-neutral-500 hover:text-neutral-700"
                >
                  {t('settings.clear_cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const autoOpenImport = searchParams.get('import') === '1'

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-20">
      <div className="mb-6">
        <Link to="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-700">
          &larr; {t('settings.back')}
        </Link>
      </div>
      <h1 className="text-2xl font-semibold mb-10">{t('settings.title')}</h1>

      <div className="space-y-12">
        <ProfileSection />
        <LocationSection />
        <DocumentsSection />
        <SafetySection />
        <PresenceSection />
        <ContributorSection />
        <PeopleSection />
        <KBSection />
        <DataSection autoOpen={autoOpenImport} />
      </div>
    </main>
  )
}
