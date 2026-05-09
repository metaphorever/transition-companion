import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../../store'
import { TOTAL_STEPS, FIRST_STEP, isValidStep, clampStep } from '../../utils/onboarding'
import Step1Welcome from './Step1Welcome'
import Step2AboutYou from './Step2AboutYou'
import Step3Location from './Step3Location'
import Step4Documents from './Step4Documents'
import Step5Safety from './Step5Safety'
import Step6Presence from './Step6Presence'
import Step7Categories from './Step7Categories'
import Step8Contributor from './Step8Contributor'
import Step9Summary from './Step9Summary'

// Public contract every step component receives. Each step decides what to do
// with onSkip vs. onNext (e.g. Step 1 has no skip button; Step 9 has no skip
// because it's the final summary).
export interface StepProps {
  step: number
  onBack: () => void
  onSkip: () => void
  onNext: () => void
  onFinish: () => void
}

export default function OnboardingWizard() {
  const params = useParams<{ step?: string }>()
  const navigate = useNavigate()

  const setOnboardingStep = useAppStore((s) => s.setOnboardingStep)
  const completeOnboarding = useAppStore((s) => s.completeOnboarding)

  // Resolve the step. Routes: `/onboarding` → step 1; `/onboarding/:step`.
  // Anything malformed clamps to a valid step rather than redirecting silently.
  const parsed = params.step ? Number(params.step) : FIRST_STEP
  const step = isValidStep(parsed) ? parsed : clampStep(parsed)

  // If URL had a malformed step, normalize it once.
  useEffect(() => {
    if (params.step && Number(params.step) !== step) {
      navigate(`/onboarding/${step}`, { replace: true })
    }
  }, [params.step, step, navigate])

  // Persist position so the user can close the browser and resume.
  // Cleared by `completeOnboarding` when the wizard finishes.
  useEffect(() => {
    setOnboardingStep(step)
  }, [step, setOnboardingStep])

  const goTo = (next: number) => {
    const target = clampStep(next)
    navigate(`/onboarding/${target}`)
  }

  const onBack = () => goTo(step - 1)
  const onSkip = () => goTo(step + 1)
  const onNext = () => goTo(step + 1)
  const onFinish = () => {
    completeOnboarding()
    navigate('/dashboard', { replace: true })
  }

  const stepProps: StepProps = { step, onBack, onSkip, onNext, onFinish }

  switch (step) {
    case 1:
      return <Step1Welcome {...stepProps} />
    case 2:
      return <Step2AboutYou {...stepProps} />
    case 3:
      return <Step3Location {...stepProps} />
    case 4:
      return <Step4Documents {...stepProps} />
    case 5:
      return <Step5Safety {...stepProps} />
    case 6:
      return <Step6Presence {...stepProps} />
    case 7:
      return <Step7Categories {...stepProps} />
    case 8:
      return <Step8Contributor {...stepProps} />
    case 9:
      return <Step9Summary {...stepProps} />
    default:
      // clampStep guarantees 1..TOTAL_STEPS, so this is unreachable. Render
      // step 1 as a defensive fallback rather than throwing — losing the
      // wizard mid-flow is worse than an unexpected first-step bounce.
      return <Step1Welcome {...stepProps} />
  }
}

export { TOTAL_STEPS }
