import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'

export default function Landing() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const profile = useAppStore((s) => s.userData.profile)

  const onboardingStep = profile.onboarding_step
  const startedAt = profile.started_at

  // Three landing states:
  //   1. Onboarding in progress → "Pick up where you left off" → that step
  //   2. Onboarding complete (started_at set) → "Continue your checklist" → /dashboard
  //   3. Fresh user → "Start your checklist" → /onboarding
  const hasInProgressOnboarding = onboardingStep !== null && onboardingStep > 0
  const hasCompletedOnboarding = startedAt !== null && !hasInProgressOnboarding

  const primary = hasInProgressOnboarding
    ? { label: t('landing.resume'), onClick: () => navigate(`/onboarding/${onboardingStep}`) }
    : hasCompletedOnboarding
      ? { label: t('landing.continue'), onClick: () => navigate('/dashboard') }
      : { label: t('landing.start'), onClick: () => navigate('/onboarding') }

  const handleImport = () => navigate('/settings?import=1')

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 max-w-lg mx-auto">
      <h1 className="text-3xl font-semibold mb-3">{t('app.name')}</h1>
      <p className="text-base text-neutral-600 mb-10 text-center">{t('landing.description')}</p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={primary.onClick}
          className="w-full py-3 px-6 bg-neutral-900 text-white rounded-lg text-sm font-medium"
        >
          {primary.label}
        </button>

        <button
          type="button"
          onClick={handleImport}
          className="w-full py-3 px-6 border border-neutral-300 text-neutral-700 rounded-lg text-sm font-medium"
        >
          {t('landing.import')}
        </button>

        <a
          href="https://github.com/metaphorever/transition-companion"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 px-6 text-center text-neutral-500 text-sm underline-offset-2 hover:underline"
        >
          {t('landing.github')}
        </a>
      </div>
    </main>
  )
}
