import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import WizardLayout from './WizardLayout'
import type { StepProps } from './OnboardingWizard'
import { useAppStore } from '../../store'
import { computeAllAvailability, filterAvailableNow } from '../../utils/ordering'
import { findDangerFlags } from '../../utils/onboarding'

export default function Step9Summary({ step, onBack, onFinish }: StepProps) {
  const { t } = useTranslation()
  const userData = useAppStore((s) => s.userData)
  const kb = useAppStore((s) => s.kb)
  const customItems = userData.custom_items
  const checklist = userData.checklist

  // Items the user has put on their list. KB-backed items use the KB label
  // when we have it; otherwise fall back to the slug so they aren't lost.
  const listedItems = useMemo(() => {
    const kbItems = Object.keys(checklist).map((slug) => ({
      key: slug,
      label: kb?.items[slug]?.label ?? slug,
      isCustom: false,
    }))
    const customs = customItems.map((c) => ({
      key: c.id,
      label: c.label,
      isCustom: true,
    }))
    return [...kbItems, ...customs].sort((a, b) => a.label.localeCompare(b.label))
  }, [checklist, customItems, kb])

  const availableNow = useMemo(() => {
    if (!kb) return []
    const all = computeAllAvailability(kb, userData)
    const items = filterAvailableNow(all, kb)
    return items
      .map((a) => ({ slug: a.slug, label: kb.items[a.slug]?.label ?? a.slug }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [kb, userData])

  const dangerFlags = useMemo(() => {
    if (!kb) return []
    return findDangerFlags(kb, userData)
  }, [kb, userData])

  const totalCount = listedItems.length

  return (
    <WizardLayout
      step={step}
      title={t('onboarding.steps.summary.title')}
      subtitle={t('onboarding.steps.summary.subtitle')}
      onBack={onBack}
      onSkip={null}
      onNext={onFinish}
      nextLabel={t('onboarding.steps.summary.start')}
    >
      <div className="space-y-8">
        <Section title={t('onboarding.steps.summary.your_list')}>
          {totalCount === 0 ? (
            <p className="text-sm text-neutral-600 leading-relaxed">
              {t('onboarding.steps.summary.your_list_empty')}
            </p>
          ) : (
            <>
              <p className="text-xs text-neutral-500 mb-2">
                {totalCount === 1
                  ? t('onboarding.steps.summary.your_list_count_one')
                  : t('onboarding.steps.summary.your_list_count_other', { count: totalCount })}
              </p>
              <ul className="space-y-1">
                {listedItems.map((item) => (
                  <li
                    key={item.key}
                    className="text-sm text-neutral-800 px-3 py-1.5 border border-neutral-100 rounded"
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>

        {totalCount > 0 && (
          <Section
            title={t('onboarding.steps.summary.available_now')}
            subtitle={t('onboarding.steps.summary.available_now_subtitle')}
          >
            {availableNow.length === 0 ? (
              <p className="text-sm text-neutral-600 leading-relaxed">
                {t('onboarding.steps.summary.available_now_empty')}
              </p>
            ) : (
              <ul className="space-y-1">
                {availableNow.map((item) => (
                  <li
                    key={item.slug}
                    className="text-sm text-neutral-900 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded"
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {dangerFlags.length > 0 && (
          <Section
            title={t('onboarding.steps.summary.danger_flags')}
            subtitle={t('onboarding.steps.summary.danger_flags_subtitle')}
            tone="caution"
          >
            <ul className="space-y-2">
              {dangerFlags.map((flag) => (
                <li
                  key={flag.slug}
                  className="px-3 py-2 border border-amber-200 bg-amber-50 rounded"
                >
                  <div className="text-sm font-medium text-neutral-900">{flag.label}</div>
                  <div className="text-xs text-amber-900 mt-0.5">
                    {flag.status === 'danger'
                      ? t('onboarding.steps.summary.danger_flags_status_danger')
                      : t('onboarding.steps.summary.danger_flags_status_unavailable')}
                  </div>
                  {flag.note && (
                    <p className="text-xs text-neutral-700 mt-1.5 leading-relaxed">{flag.note}</p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <p className="text-xs text-neutral-500 italic">
          {t('onboarding.steps.summary.see_full_list')}
        </p>
      </div>
    </WizardLayout>
  )
}

function Section({
  title,
  subtitle,
  tone = 'default',
  children,
}: {
  title: string
  subtitle?: string
  tone?: 'default' | 'caution'
  children: React.ReactNode
}) {
  return (
    <section>
      <h2
        className={`text-base font-semibold mb-1 ${
          tone === 'caution' ? 'text-amber-900' : 'text-neutral-900'
        }`}
      >
        {title}
      </h2>
      {subtitle && <p className="text-xs text-neutral-500 mb-3 leading-relaxed">{subtitle}</p>}
      {children}
    </section>
  )
}
