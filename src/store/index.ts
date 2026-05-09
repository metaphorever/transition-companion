import { create } from 'zustand'
import type { UserData, KBCache, ItemStatus, ChecklistEntry, UserProfile, CustomItem, StatusLogEntry, Blocker, Person } from '../types'
import {
  readUserData,
  updateUserData,
  exportUserData,
  importUserData,
  clearUserData,
} from '../utils/storage'
import { loadKB, refreshKB } from '../utils/kb'

type ProfilePatch = Partial<UserProfile> | ((profile: UserProfile) => Partial<UserProfile>)

interface AppState {
  userData: UserData
  kb: KBCache | null
  kbLoading: boolean
  kbError: string | null

  // UserData actions
  refreshUserData: () => void
  patchUserData: (patch: (data: UserData) => UserData | void) => void
  exportData: () => string
  importData: (json: string) => { ok: boolean; error?: string }
  clearData: () => void

  // Profile / wizard actions
  patchProfile: (patch: ProfilePatch) => void
  setOnboardingStep: (step: number | null) => void
  completeOnboarding: () => void

  // Checklist actions
  setItemStatus: (slug: string, status: ItemStatus) => void
  setItemNotes: (slug: string, notes: string) => void
  getOrCreateEntry: (slug: string) => ChecklistEntry
  addItemToChecklist: (slug: string) => void
  removeItemFromChecklist: (slug: string) => void

  // Blocker actions
  addBlocker: (slug: string, blocker: Omit<Blocker, 'id'>) => void
  updateBlocker: (slug: string, blockerId: string, patch: Partial<Omit<Blocker, 'id'>>) => void
  removeBlocker: (slug: string, blockerId: string) => void

  // People actions
  addPerson: (person: Omit<Person, 'id'>) => void
  updatePerson: (id: string, patch: Partial<Omit<Person, 'id'>>) => void
  removePerson: (id: string) => void

  // Custom item actions
  addCustomItem: (item: Omit<CustomItem, 'id' | 'status'>) => void
  removeCustomItem: (id: string) => void

  // KB actions
  initKB: () => Promise<void>
  forceRefreshKB: () => Promise<void>
}

const DEFAULT_ENTRY: ChecklistEntry = {
  status: 'not_started',
  completed_at: null,
  blockers: [],
  notes: '',
  custom_fields: {},
}

export const useAppStore = create<AppState>((set, get) => ({
  userData: readUserData(),
  kb: null,
  kbLoading: false,
  kbError: null,

  refreshUserData: () => set({ userData: readUserData() }),

  patchUserData: (patch) => {
    const next = updateUserData(patch)
    set({ userData: next })
  },

  exportData: () => exportUserData(),

  importData: (json) => {
    const result = importUserData(json)
    if (result.ok) set({ userData: readUserData() })
    return result
  },

  clearData: () => {
    clearUserData()
    set({ userData: readUserData() })
  },

  patchProfile: (patch) => {
    get().patchUserData((data) => {
      const next = typeof patch === 'function' ? patch(data.profile) : patch
      data.profile = { ...data.profile, ...next }
    })
  },

  setOnboardingStep: (step) => {
    get().patchUserData((data) => {
      data.profile = { ...data.profile, onboarding_step: step }
    })
  },

  completeOnboarding: () => {
    get().patchUserData((data) => {
      data.profile = {
        ...data.profile,
        onboarding_step: null,
        started_at: data.profile.started_at ?? new Date().toISOString(),
      }
    })
  },

  setItemStatus: (slug, status) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      const logEntry: StatusLogEntry = {
        status,
        at: new Date().toISOString().split('T')[0],
      }
      data.checklist[slug] = {
        ...entry,
        status,
        completed_at: status === 'complete' ? new Date().toISOString() : entry.completed_at,
        status_log: [...(entry.status_log ?? []), logEntry],
      }
    })
  },

  setItemNotes: (slug, notes) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      data.checklist[slug] = { ...entry, notes }
    })
  },

  getOrCreateEntry: (slug) => {
    const { userData } = get()
    return userData.checklist[slug] ?? { ...DEFAULT_ENTRY }
  },

  addItemToChecklist: (slug) => {
    get().patchUserData((data) => {
      if (data.checklist[slug]) return
      data.checklist[slug] = { ...DEFAULT_ENTRY }
    })
  },

  removeItemFromChecklist: (slug) => {
    get().patchUserData((data) => {
      delete data.checklist[slug]
    })
  },

  addBlocker: (slug, blocker) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      const id = `blocker-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      data.checklist[slug] = {
        ...entry,
        blockers: [...entry.blockers, { id, ...blocker }],
      }
    })
  },

  updateBlocker: (slug, blockerId, patch) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug]
      if (!entry) return
      data.checklist[slug] = {
        ...entry,
        blockers: entry.blockers.map((b) =>
          b.id === blockerId ? { ...b, ...patch } : b
        ),
      }
    })
  },

  removeBlocker: (slug, blockerId) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug]
      if (!entry) return
      data.checklist[slug] = {
        ...entry,
        blockers: entry.blockers.filter((b) => b.id !== blockerId),
      }
    })
  },

  addPerson: (person) => {
    get().patchUserData((data) => {
      const id = `person-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      data.people = { ...data.people, [id]: { id, ...person } }
    })
  },

  updatePerson: (id, patch) => {
    get().patchUserData((data) => {
      if (!data.people[id]) return
      data.people = { ...data.people, [id]: { ...data.people[id], ...patch } }
    })
  },

  removePerson: (id) => {
    get().patchUserData((data) => {
      const next = { ...data.people }
      delete next[id]
      data.people = next
    })
  },

  addCustomItem: (item) => {
    get().patchUserData((data) => {
      const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      data.custom_items = [
        ...data.custom_items,
        { id, status: 'not_started', ...item },
      ]
    })
  },

  removeCustomItem: (id) => {
    get().patchUserData((data) => {
      data.custom_items = data.custom_items.filter((c) => c.id !== id)
    })
  },

  initKB: async () => {
    set({ kbLoading: true, kbError: null })
    try {
      const kb = await loadKB()
      set({ kb, kbLoading: false })
    } catch {
      set({
        kbLoading: false,
        kbError:
          'Could not load the knowledge base. Your checklist data is safe. Check your connection and try refreshing.',
      })
    }
  },

  forceRefreshKB: async () => {
    set({ kbLoading: true, kbError: null })
    try {
      const kb = await refreshKB()
      set({ kb, kbLoading: false })
    } catch {
      set({
        kbLoading: false,
        kbError:
          'Could not reach the knowledge base. Check your connection and try again.',
      })
    }
  },
}))
