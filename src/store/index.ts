import { create } from 'zustand'
import type { UserData, KBCache, ItemStatus, ChecklistEntry } from '../types'
import {
  readUserData,
  updateUserData,
  exportUserData,
  importUserData,
  clearUserData,
} from '../utils/storage'
import { loadKB, refreshKB } from '../utils/kb'

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

  // Checklist actions
  setItemStatus: (slug: string, status: ItemStatus) => void
  setItemNotes: (slug: string, notes: string) => void
  getOrCreateEntry: (slug: string) => ChecklistEntry

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

  setItemStatus: (slug, status) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      data.checklist[slug] = {
        ...entry,
        status,
        completed_at: status === 'complete' ? new Date().toISOString() : entry.completed_at,
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
