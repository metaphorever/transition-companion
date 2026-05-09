import { useTranslation } from 'react-i18next'
import { useMemo, useState, useRef, useEffect } from 'react'
import WizardLayout from './WizardLayout'
import type { StepProps } from './OnboardingWizard'
import { useAppStore } from '../../store'
import { COUNTRIES, getRegionsForCountry, getCountryLabel } from '../../utils/locations'

export default function Step3Location({ step, onBack, onSkip, onNext }: StepProps) {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const patchProfile = useAppStore((s) => s.patchProfile)

  const country = profile.jurisdiction.country
  const region = profile.jurisdiction.region
  const regions = useMemo(() => getRegionsForCountry(country), [country])

  const setCountry = (code: string | null) => {
    patchProfile({ jurisdiction: { country: code, region: null } })
  }
  const setRegion = (code: string | null) => {
    patchProfile({ jurisdiction: { country, region: code } })
  }

  // Heuristic: if the user picked a country and we don't yet have KB
  // jurisdiction data for it, surface the reassuring note. KB cache is
  // optional here — if it isn't loaded, we don't show the note (no false
  // alarm).
  const kb = useAppStore((s) => s.kb)
  const showNoKBDataNote = useMemo(() => {
    if (!country || !kb) return false
    const hasAny = Object.values(kb.jurisdictions).some(
      (j) => j.jurisdiction.country === country
    )
    return !hasAny
  }, [country, kb])

  return (
    <WizardLayout
      step={step}
      title={t('onboarding.steps.location.title')}
      subtitle={t('onboarding.steps.location.subtitle')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <div className="space-y-6">
        <div>
          <label
            htmlFor="country"
            className="block text-sm font-medium text-neutral-800 mb-2"
          >
            {t('onboarding.steps.location.country_label')}
          </label>
          <CountryCombobox
            value={country}
            onChange={setCountry}
            placeholder={t('onboarding.steps.location.country_placeholder')}
          />
        </div>

        {country && (
          <div>
            <label
              htmlFor="region"
              className="block text-sm font-medium text-neutral-800 mb-2"
            >
              {t('onboarding.steps.location.region_label')}
            </label>
            {regions ? (
              <select
                id="region"
                value={region ?? ''}
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
                id="region"
                type="text"
                value={region ?? ''}
                onChange={(e) => setRegion(e.target.value || null)}
                placeholder={t('onboarding.steps.location.region_placeholder')}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
              />
            )}
          </div>
        )}

        {showNoKBDataNote && (
          <p className="text-sm text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-3 leading-relaxed">
            {t('onboarding.steps.location.no_kb_data')}
          </p>
        )}
      </div>
    </WizardLayout>
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

  // Sync the visible text when the stored value changes externally (e.g. the
  // user navigated away and back). Adjusting state during render — preferred
  // over useEffect for prop-derived state.
  if (value !== trackedValue) {
    setTrackedValue(value)
    setQuery(getCountryLabel(value) ?? '')
  }

  // Click-outside collapses the suggestion list.
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
        id="country"
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
