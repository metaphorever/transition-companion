import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import WizardLayout from './WizardLayout'
import type { StepProps } from './OnboardingWizard'
import { useAppStore } from '../../store'
import {
  getApplicableDocStateGroups,
  defaultDocumentState,
  type DocStateItemConfig,
  type DocStateGroup,
} from '../../utils/onboarding'
import type { DocFieldStatus, DocumentState, KBItem } from '../../types'

const FIELD_STATUSES: DocFieldStatus[] = ['old', 'new', 'in_progress', 'unknown']

export default function Step4Documents({ step, onBack, onSkip, onNext }: StepProps) {
  const { t } = useTranslation()
  const profile = useAppStore((s) => s.userData.profile)
  const checklist = useAppStore((s) => s.userData.checklist)
  const kb = useAppStore((s) => s.kb)
  const setItemDocumentState = useAppStore((s) => s.setItemDocumentState)

  const applicable = useMemo(
    () => getApplicableDocStateGroups(kb, profile.jurisdiction, profile.birth_jurisdiction),
    [kb, profile.jurisdiction, profile.birth_jurisdiction]
  )

  if (applicable.length === 0) {
    return (
      <WizardLayout
        step={step}
        title={t('onboarding.steps.documents.title')}
        subtitle={t('onboarding.steps.documents.subtitle')}
        onBack={onBack}
        onSkip={onSkip}
        onNext={onNext}
      >
        <p className="text-sm text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-3 leading-relaxed">
          {t('onboarding.steps.documents.no_applicable_items')}
        </p>
      </WizardLayout>
    )
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
      <p className="text-xs text-neutral-500 leading-relaxed mb-4">
        {t('onboarding.steps.documents.skip_hint')}
      </p>
      <div className="space-y-3">
        {applicable.map((group) => {
          if (group.kind === 'pair') {
            return (
              <DocStatePairRow
                key={group.physical_document_id}
                group={group}
                nameValue={checklist[group.nameConfig.slug]?.document_state ?? null}
                markerValue={checklist[group.markerConfig.slug]?.document_state ?? null}
                onNameChange={(v) => setItemDocumentState(group.nameConfig.slug, v)}
                onMarkerChange={(v) => setItemDocumentState(group.markerConfig.slug, v)}
              />
            )
          }
          const current = checklist[group.config.slug]?.document_state ?? null
          return (
            <DocStateRow
              key={group.config.slug}
              config={group.config}
              item={group.item}
              value={current}
              onChange={(v) => setItemDocumentState(group.config.slug, v)}
            />
          )
        })}
      </div>
    </WizardLayout>
  )
}

interface DocStateRowProps {
  config: DocStateItemConfig
  item: KBItem
  value: DocumentState | null
  onChange: (v: DocumentState | null) => void
}

function DocStateRow({ config, item, value, onChange }: DocStateRowProps) {
  const { t } = useTranslation()
  const filled = value !== null

  const enable = () => {
    onChange(defaultDocumentState(config.kind))
  }
  const clear = () => onChange(null)

  // Helpers that mutate the polymorphic shape safely by re-using current kind.
  const setNameStatus = (s: DocFieldStatus) => {
    if (!value) return
    if (value.kind === 'name' || value.kind === 'full') {
      onChange({ ...value, name_status: s })
    }
  }
  const setMarkerStatus = (s: DocFieldStatus) => {
    if (!value) return
    if (value.kind === 'marker' || value.kind === 'full') {
      onChange({ ...value, marker_status: s })
    }
  }
  const setIssued = (d: string | null) => {
    if (!value) return
    onChange({ ...value, issued: d })
  }
  const setExpiration = (d: string | null) => {
    if (!value) return
    if (value.kind === 'name' || value.kind === 'full') {
      onChange({ ...value, expiration_date: d })
    }
  }

  return (
    <div className="border border-neutral-200 rounded-md">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100">
        <div className="text-sm font-medium text-neutral-800">{item.label}</div>
        {!filled ? (
          <button
            type="button"
            onClick={enable}
            className="text-xs text-neutral-700 underline-offset-2 hover:underline"
          >
            {t('onboarding.steps.documents.tell_us')}
          </button>
        ) : (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            {t('onboarding.steps.documents.decide_later')}
          </button>
        )}
      </div>
      {filled && value && (
        <div className="px-3 py-3 space-y-3">
          {(value.kind === 'name' || value.kind === 'full') && (
            <StatusPicker
              label={t('onboarding.steps.documents.name_status_label')}
              value={value.name_status}
              onChange={setNameStatus}
            />
          )}
          {(value.kind === 'marker' || value.kind === 'full') && (
            <StatusPicker
              label={t('onboarding.steps.documents.marker_status_label')}
              value={value.marker_status}
              onChange={setMarkerStatus}
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateInput
              label={t('onboarding.steps.documents.issued_label')}
              value={value.issued}
              onChange={setIssued}
            />
            {!item.never_expires && (value.kind === 'name' || value.kind === 'full') && (
              <DateInput
                label={t('onboarding.steps.documents.expiration_label')}
                value={value.expiration_date}
                onChange={setExpiration}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface DocStatePairRowProps {
  group: Extract<DocStateGroup, { kind: 'pair' }>
  nameValue: DocumentState | null
  markerValue: DocumentState | null
  onNameChange: (v: DocumentState | null) => void
  onMarkerChange: (v: DocumentState | null) => void
}

function DocStatePairRow({
  group,
  nameValue,
  markerValue,
  onNameChange,
  onMarkerChange,
}: DocStatePairRowProps) {
  const { t } = useTranslation()
  // Opted-in if either entry has captured state.
  const filled = nameValue !== null || markerValue !== null

  const enable = () => {
    onNameChange(defaultDocumentState('name'))
    onMarkerChange(defaultDocumentState('marker'))
  }
  const clear = () => {
    onNameChange(null)
    onMarkerChange(null)
  }

  // Defensive helpers: if one entry is null when the user edits, initialize it.
  const effectiveName = (): Extract<DocumentState, { kind: 'name' }> => {
    const d = nameValue ?? defaultDocumentState('name')
    return d as Extract<DocumentState, { kind: 'name' }>
  }
  const effectiveMarker = (): Extract<DocumentState, { kind: 'marker' }> => {
    const d = markerValue ?? defaultDocumentState('marker')
    return d as Extract<DocumentState, { kind: 'marker' }>
  }

  const setNameStatus = (s: DocFieldStatus) => onNameChange({ ...effectiveName(), name_status: s })
  const setMarkerStatus = (s: DocFieldStatus) =>
    onMarkerChange({ ...effectiveMarker(), marker_status: s })

  // Issued is shared — written to both entries simultaneously.
  const issuedValue = nameValue?.issued ?? markerValue?.issued ?? null
  const setIssued = (d: string | null) => {
    onNameChange({ ...effectiveName(), issued: d })
    onMarkerChange({ ...effectiveMarker(), issued: d })
  }

  // Expiration lives on the name entry only (marker kind has no expiration_date).
  const showExpiration = !group.nameItem.never_expires
  const expirationValue =
    nameValue && 'expiration_date' in nameValue ? nameValue.expiration_date : null
  const setExpiration = (d: string | null) => {
    onNameChange({ ...effectiveName(), expiration_date: d })
  }

  const nameStatus =
    nameValue && nameValue.kind === 'name' ? nameValue.name_status : 'unknown'
  const markerStatus =
    markerValue && markerValue.kind === 'marker' ? markerValue.marker_status : 'unknown'

  return (
    <div className="border border-neutral-200 rounded-md">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100">
        <div className="text-sm font-medium text-neutral-800">{group.label}</div>
        {!filled ? (
          <button
            type="button"
            onClick={enable}
            className="text-xs text-neutral-700 underline-offset-2 hover:underline"
          >
            {t('onboarding.steps.documents.tell_us')}
          </button>
        ) : (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            {t('onboarding.steps.documents.decide_later')}
          </button>
        )}
      </div>
      {filled && (
        <div className="px-3 py-3 space-y-3">
          <StatusPicker
            label={t('onboarding.steps.documents.name_status_label')}
            value={nameStatus}
            onChange={setNameStatus}
          />
          <StatusPicker
            label={t('onboarding.steps.documents.marker_status_label')}
            value={markerStatus}
            onChange={setMarkerStatus}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateInput
              label={t('onboarding.steps.documents.issued_label')}
              value={issuedValue}
              onChange={setIssued}
            />
            {showExpiration && (
              <DateInput
                label={t('onboarding.steps.documents.expiration_label')}
                value={expirationValue}
                onChange={setExpiration}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: DocFieldStatus
  onChange: (s: DocFieldStatus) => void
}) {
  const { t } = useTranslation()
  return (
    <div>
      <div className="text-xs text-neutral-600 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-2">
        {FIELD_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`px-3 py-1.5 text-xs rounded-md border ${
              value === s
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {t(`onboarding.steps.documents.field_status.${s}`)}
          </button>
        ))}
      </div>
    </div>
  )
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null
  onChange: (d: string | null) => void
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-600 mb-1.5">{label}</label>
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
      />
    </div>
  )
}
