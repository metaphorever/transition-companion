import { useTranslation } from 'react-i18next'
import { useMemo, useState, useRef, useEffect } from 'react'
import WizardLayout from './WizardLayout'
import type { StepProps } from './OnboardingWizard'
import { useAppStore } from '../../store'
import { COUNTRIES, getRegionsForCountry, getCountryLabel } from '../../utils/locations'

type JLike = { country: string | null; region: string | null }

export default function Step3Location({ step, onBack, onSkip, onNext }: StepProps) {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const patchProfile = useAppStore((s) => s.patchProfile)
  const kb = useAppStore((s) => s.kb)

  const country = profile.jurisdiction.country
  const showNoKBDataNote = useMemo(() => {
    if (!country || !kb) return false
    const hasAny = Object.values(kb.jurisdictions).some(
      (j) => j.jurisdiction.country === country
    )
    return !hasAny
  }, [country, kb])

  const setMain = (next: JLike) => {
    patchProfile({ jurisdiction: next })
  }

  const birth = profile.birth_jurisdiction ?? null
  const [birthExpanded, setBirthExpanded] = useState(
    Boolean(birth?.country) && (birth?.country !== country || birth?.region !== profile.jurisdiction.region)
  )
  const setBirth = (next: JLike | null) => {
    patchProfile({ birth_jurisdiction: next })
  }

  const others = profile.other_jurisdictions ?? []
  const [othersExpanded, setOthersExpanded] = useState(others.length > 0)
  const setOthers = (next: JLike[]) => {
    patchProfile({ other_jurisdictions: next })
  }

  return (
    <WizardLayout
      step={step}
      title={t('onboarding.steps.location.title')}
      subtitle={t('onboarding.steps.location.subtitle')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <div className="space-y-8">
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-neutral-800">
            {t('onboarding.steps.location.current_heading')}
          </h3>
          <JurisdictionPicker value={profile.jurisdiction} onChange={setMain} />
          {showNoKBDataNote && (
            <p className="text-sm text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-3 leading-relaxed">
              {t('onboarding.steps.location.no_kb_data')}
            </p>
          )}
        </section>

        <section className="space-y-3 border-t border-neutral-100 pt-6">
          <button
            type="button"
            onClick={() => setBirthExpanded((v) => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <div>
              <div className="text-sm font-medium text-neutral-800">
                {t('onboarding.steps.location.birth_heading')}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                {t('onboarding.steps.location.birth_hint')}
              </div>
            </div>
            <span className="text-xs text-neutral-500 underline-offset-2">
              {birthExpanded
                ? t('onboarding.steps.location.hide')
                : t('onboarding.steps.location.add')}
            </span>
          </button>
          {birthExpanded && (
            <div className="space-y-3">
              <JurisdictionPicker
                value={birth ?? { country: null, region: null }}
                onChange={(v) =>
                  setBirth(v.country || v.region ? v : null)
                }
              />
              {birth && (birth.country || birth.region) && (
                <button
                  type="button"
                  onClick={() => {
                    setBirth(null)
                    setBirthExpanded(false)
                  }}
                  className="text-xs text-neutral-500 underline-offset-2 hover:underline"
                >
                  {t('onboarding.steps.location.clear')}
                </button>
              )}
            </div>
          )}
        </section>

        <section className="space-y-3 border-t border-neutral-100 pt-6">
          <button
            type="button"
            onClick={() => setOthersExpanded((v) => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <div>
              <div className="text-sm font-medium text-neutral-800">
                {t('onboarding.steps.location.others_heading')}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                {t('onboarding.steps.location.others_hint')}
              </div>
            </div>
            <span className="text-xs text-neutral-500 underline-offset-2">
              {othersExpanded
                ? t('onboarding.steps.location.hide')
                : t('onboarding.steps.location.add')}
            </span>
          </button>
          {othersExpanded && (
            <div className="space-y-3">
              {others.map((j, idx) => (
                <div key={idx} className="space-y-2 border border-neutral-200 rounded-md p-3">
                  <JurisdictionPicker
                    value={j}
                    onChange={(v) => {
                      const next = [...others]
                      next[idx] = v
                      setOthers(next)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setOthers(others.filter((_, i) => i !== idx))}
                    className="text-xs text-neutral-500 underline-offset-2 hover:underline"
                  >
                    {t('onboarding.steps.location.remove_other')}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setOthers([...others, { country: null, region: null }])}
                className="text-sm text-neutral-700 underline-offset-2 hover:underline"
              >
                {t('onboarding.steps.location.add_another_other')}
              </button>
            </div>
          )}
        </section>
      </div>
    </WizardLayout>
  )
}

interface JurisdictionPickerProps {
  value: JLike
  onChange: (next: JLike) => void
}

function JurisdictionPicker({ value, onChange }: JurisdictionPickerProps) {
  const { t } = useTranslation()
  const regions = useMemo(() => getRegionsForCountry(value.country), [value.country])

  const setCountry = (code: string | null) => {
    onChange({ country: code, region: null })
  }
  const setRegion = (code: string | null) => {
    onChange({ country: value.country, region: code })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-neutral-800 mb-2">
          {t('onboarding.steps.location.country_label')}
        </label>
        <CountryCombobox
          value={value.country}
          onChange={setCountry}
          placeholder={t('onboarding.steps.location.country_placeholder')}
        />
      </div>
      {value.country && (
        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-2">
            {t('onboarding.steps.location.region_label')}
          </label>
          {regions ? (
            <select
              value={value.region ?? ''}
              onChange={(e) => setRegion(e.target.value || null)}
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
              type="text"
              value={value.region ?? ''}
              onChange={(e) => setRegion(e.target.value || null)}
              placeholder={t('onboarding.steps.location.region_placeholder')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
            />
          )}
        </div>
      )}
    </div>
  )
}

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
