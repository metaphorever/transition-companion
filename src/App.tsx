import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAppStore } from './store'
import Landing from './components/Landing'
import OnboardingWizard from './components/onboarding/OnboardingWizard'
import Dashboard from './components/dashboard/Dashboard'
import ChecklistView from './components/checklist/ChecklistView'
import ItemDetail from './components/item-detail/ItemDetail'
import Contribute from './components/contribute/Contribute'
import Settings from './components/Settings'
import PeopleMap from './components/people/PeopleMap'

function AppRoutes() {
  const initKB = useAppStore(s => s.initKB)

  useEffect(() => {
    initKB()
  }, [initKB])

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/onboarding" element={<OnboardingWizard />} />
      <Route path="/onboarding/:step" element={<OnboardingWizard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/checklist" element={<ChecklistView />} />
      <Route path="/item/:slug" element={<ItemDetail />} />
      <Route path="/contribute" element={<Contribute />} />
      <Route path="/contribute/:slug" element={<Contribute />} />
      <Route path="/people" element={<PeopleMap />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
