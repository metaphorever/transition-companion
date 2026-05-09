import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { TOTAL_STEPS } from '../../utils/onboarding'

interface WizardLayoutProps {
  step: number
  title?: string
  subtitle?: string
  children: ReactNode
  // Footer behaviour. Each handler is optional; pass null to hide that button.
  onBack?: (() => void) | null
  onSkip?: (() => void) | null
  onNext?: (() => void) | null
  // The label on the primary advance button. Defaults to "Next" except on the
  // final step, where the caller should pass the localized "Let's go".
  nextLabel?: string
  // When true, suppress the chrome (header, progress) — used by Step 1 (Welcome)
  // so the welcome screen doesn't feel like a wizard yet.
  bareHeader?: boolean
}

export default function WizardLayout({
  step,
  title,
  subtitle,
  children,
  onBack,
  onSkip,
  onNext,
  nextLabel,
  bareHeader = false,
}: WizardLayoutProps) {
  const { t } = useTranslation()

  const showBack = onBack !== null && onBack !== undefined
  const showSkip = onSkip !== null && onSkip !== undefined
  const showNext = onNext !== null && onNext !== undefined

  return (
    <main className="min-h-screen flex flex-col px-4 py-8 max-w-xl mx-auto">
      {!bareHeader && (
        <header className="mb-8">
          <div
            className="text-xs uppercase tracking-wide text-neutral-500 mb-3"
            aria-live="polite"
          >
            {t('onboarding.step_of', { current: step, total: TOTAL_STEPS })}
          </div>
          <ProgressBar current={step} total={TOTAL_STEPS} />
          {title && <h1 className="text-2xl font-semibold mt-6">{title}</h1>}
          {subtitle && (
            <p className="text-sm text-neutral-600 mt-2 leading-relaxed">{subtitle}</p>
          )}
        </header>
      )}

      <div className="flex-1">{children}</div>

      <footer className="mt-10 pt-6 border-t border-neutral-200">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 text-sm text-neutral-700 hover:text-neutral-900"
              >
                {t('onboarding.back')}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="px-4 py-2 text-sm text-neutral-600 underline-offset-2 hover:underline"
              >
                {t('onboarding.skip')}
              </button>
            )}
            {showNext && (
              <button
                type="button"
                onClick={onNext}
                className="px-5 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium"
              >
                {nextLabel ?? t('onboarding.next')}
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-4 leading-relaxed">
          {t('onboarding.your_progress_is_saved')}
        </p>
      </footer>
    </main>
  )
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round(((current - 1) / (total - 1)) * 100)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-1 w-full bg-neutral-200 rounded-full overflow-hidden"
    >
      <div
        className="h-full bg-neutral-900 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
