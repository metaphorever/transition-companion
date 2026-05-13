import { create } from 'zustand'
import type { UserData, KBCache, ItemStatus, ItemIntent, ItemPriority, DocumentState, ChecklistEntry, UserProfile, CustomItem, StatusLogEntry, Blocker, Person, RecurringItem, SubTask } from '../types'
import {
  readUserData,
  updateUserData,
  exportUserData,
  importUserData,
  clearUserData,
} from '../utils/storage'
import { loadKB, refreshKB } from '../utils/kb'
import { localDateString } from '../utils/recurring'

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
  setItemIntent: (slug: string, intent: ItemIntent) => void
  setItemNotes: (slug: string, notes: string) => void
  setItemDueDate: (slug: string, due_date: string | null) => void
  setItemEventDate: (slug: string, event_date: string | null) => void
  setItemPriority: (slug: string, priority: ItemPriority | null) => void
  setItemRevisitAt: (slug: string, revisit_at: string | null) => void
  setItemDocumentState: (slug: string, document_state: DocumentState | null) => void
  setItemJurisdictionOverride: (
    slug: string,
    override: { country: string | null; region: string | null } | null
  ) => void
  getOrCreateEntry: (slug: string) => ChecklistEntry
  addItemToChecklist: (slug: string) => void
  removeItemFromChecklist: (slug: string) => void

  // Blocker actions
  // Store fills in `id`, `status: 'active'`, `status_date: <today>` so callers
  // only declare the substantive fields. Use updateBlocker/resolveBlocker etc.
  // to advance status afterward.
  addBlocker: (slug: string, blocker: Omit<Blocker, 'id' | 'status' | 'status_date'>) => string
  updateBlocker: (slug: string, blockerId: string, patch: Partial<Omit<Blocker, 'id'>>) => void
  removeBlocker: (slug: string, blockerId: string) => void
  resolveBlocker: (slug: string, blockerId: string) => void
  dismissBlocker: (slug: string, blockerId: string) => void
  // Undo a resolve/dismiss — flips status back to 'active' and bumps status_date.
  reactivateBlocker: (slug: string, blockerId: string) => void
  // Spawn a custom item as a resolution task for the blocker, and link the
  // new task's id into the blocker's resolution_task_ids. Returns the new
  // task id. Caller supplies the substantive task fields.
  convertBlockerToTask: (
    slug: string,
    blockerId: string,
    taskInit: { label: string; category: string; track: string; description?: string }
  ) => string

  // People actions
  addPerson: (person: Omit<Person, 'id'>) => void
  updatePerson: (id: string, patch: Partial<Omit<Person, 'id'>>) => void
  removePerson: (id: string) => void

  // Custom item actions
  addCustomItem: (item: Omit<CustomItem, 'id' | 'status'>) => void
  updateCustomItem: (id: string, patch: Partial<Omit<CustomItem, 'id'>>) => void
  removeCustomItem: (id: string) => void

  // Recurring item actions
  addRecurringItem: (item: Omit<RecurringItem, 'id'>) => void
  updateRecurringItem: (id: string, patch: Partial<Omit<RecurringItem, 'id'>>) => void
  removeRecurringItem: (id: string) => void
  // Log completion: sets last_logged_at to today; for fixed mode next_date stays null (computed on the fly)
  logRecurringItem: (id: string) => void

  // Sub-task actions (on checklist entries)
  addSubTask: (slug: string, task: Omit<SubTask, 'id' | 'done' | 'done_at'>) => void
  updateSubTask: (slug: string, taskId: string, patch: Partial<Omit<SubTask, 'id'>>) => void
  removeSubTask: (slug: string, taskId: string) => void
  toggleSubTask: (slug: string, taskId: string) => void

  // KB actions
  initKB: () => Promise<void>
  forceRefreshKB: () => Promise<void>
}

const DEFAULT_ENTRY: ChecklistEntry = {
  status: 'not_started',
  intent: 'update',
  completed_at: null,
  blockers: [],
  notes: '',
  custom_fields: {},
  sub_tasks: [],
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
        at: localDateString(),
      }
      data.checklist[slug] = {
        ...entry,
        status,
        completed_at: status === 'complete' ? new Date().toISOString() : entry.completed_at,
        status_log: [...(entry.status_log ?? []), logEntry],
      }
    })
  },

  setItemIntent: (slug, intent) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      data.checklist[slug] = { ...entry, intent }
    })
  },

  setItemNotes: (slug, notes) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      data.checklist[slug] = { ...entry, notes }
    })
  },

  setItemDueDate: (slug, due_date) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      data.checklist[slug] = { ...entry, due_date }
    })
  },

  setItemEventDate: (slug, event_date) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      data.checklist[slug] = { ...entry, event_date }
    })
  },

  setItemPriority: (slug, priority) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      data.checklist[slug] = { ...entry, priority }
    })
  },

  setItemRevisitAt: (slug, revisit_at) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      data.checklist[slug] = { ...entry, revisit_at }
    })
  },

  setItemDocumentState: (slug, document_state) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      data.checklist[slug] = { ...entry, document_state }
    })
  },

  setItemJurisdictionOverride: (slug, override) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      data.checklist[slug] = { ...entry, jurisdiction_override: override }
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
    const id = `blocker-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      const today = localDateString()
      const full: Blocker = {
        id,
        status: 'active',
        status_date: today,
        ...blocker,
      }
      data.checklist[slug] = {
        ...entry,
        blockers: [...entry.blockers, full],
      }
    })
    return id
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

  resolveBlocker: (slug, blockerId) => {
    const today = localDateString()
    get().patchUserData((data) => {
      const entry = data.checklist[slug]
      if (!entry) return
      data.checklist[slug] = {
        ...entry,
        blockers: entry.blockers.map((b) =>
          b.id === blockerId ? { ...b, status: 'resolved', status_date: today } : b
        ),
      }
    })
  },

  dismissBlocker: (slug, blockerId) => {
    const today = localDateString()
    get().patchUserData((data) => {
      const entry = data.checklist[slug]
      if (!entry) return
      data.checklist[slug] = {
        ...entry,
        blockers: entry.blockers.map((b) =>
          b.id === blockerId ? { ...b, status: 'manually_dismissed', status_date: today } : b
        ),
      }
    })
  },

  reactivateBlocker: (slug, blockerId) => {
    const today = localDateString()
    get().patchUserData((data) => {
      const entry = data.checklist[slug]
      if (!entry) return
      data.checklist[slug] = {
        ...entry,
        blockers: entry.blockers.map((b) =>
          b.id === blockerId ? { ...b, status: 'active', status_date: today } : b
        ),
      }
    })
  },

  convertBlockerToTask: (slug, blockerId, taskInit) => {
    const newId = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    get().patchUserData((data) => {
      // Spawn the custom item.
      data.custom_items = [
        ...data.custom_items,
        {
          id: newId,
          label: taskInit.label,
          description: taskInit.description,
          category: taskInit.category,
          track: taskInit.track,
          status: 'not_started',
          notes: '',
          provenance: 'user_created',
        },
      ]
      // Give it its own checklist entry so it can carry sub-tasks/blockers.
      if (!data.checklist[newId]) {
        data.checklist[newId] = { ...DEFAULT_ENTRY }
      }
      // Link the new task into the parent blocker's resolution_task_ids.
      const entry = data.checklist[slug]
      if (entry) {
        data.checklist[slug] = {
          ...entry,
          blockers: entry.blockers.map((b) => {
            if (b.id !== blockerId) return b
            const existing = b.resolution_task_ids ?? []
            return { ...b, resolution_task_ids: [...existing, newId] }
          }),
        }
      }
    })
    return newId
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
      // Create a ChecklistEntry so the custom item gets sub-tasks, blockers, intent, dates
      if (!data.checklist[id]) {
        data.checklist[id] = { ...DEFAULT_ENTRY }
      }
    })
  },

  updateCustomItem: (id, patch) => {
    get().patchUserData((data) => {
      data.custom_items = data.custom_items.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      )
    })
  },

  removeCustomItem: (id) => {
    get().patchUserData((data) => {
      data.custom_items = data.custom_items.filter((c) => c.id !== id)
      delete data.checklist[id]
    })
  },

  addRecurringItem: (item) => {
    get().patchUserData((data) => {
      const id = `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      data.recurring_items = [...(data.recurring_items ?? []), { id, ...item }]
    })
  },

  updateRecurringItem: (id, patch) => {
    get().patchUserData((data) => {
      data.recurring_items = (data.recurring_items ?? []).map((r) =>
        r.id === id ? { ...r, ...patch } : r
      )
    })
  },

  removeRecurringItem: (id) => {
    get().patchUserData((data) => {
      data.recurring_items = (data.recurring_items ?? []).filter((r) => r.id !== id)
    })
  },

  logRecurringItem: (id) => {
    get().patchUserData((data) => {
      const today = localDateString()
      data.recurring_items = (data.recurring_items ?? []).map((r) => {
        if (r.id !== id) return r
        if (r.mode === 'fixed') {
          return { ...r, last_logged_at: today }
        }
        return { ...r, last_logged_at: today, next_date: null }
      })
    })
  },

  addSubTask: (slug, task) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug] ?? { ...DEFAULT_ENTRY }
      const id = `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      data.checklist[slug] = {
        ...entry,
        sub_tasks: [...(entry.sub_tasks ?? []), { id, done: false, done_at: null, ...task }],
      }
    })
  },

  updateSubTask: (slug, taskId, patch) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug]
      if (!entry) return
      data.checklist[slug] = {
        ...entry,
        sub_tasks: (entry.sub_tasks ?? []).map((t) =>
          t.id === taskId ? { ...t, ...patch } : t
        ),
      }
    })
  },

  removeSubTask: (slug, taskId) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug]
      if (!entry) return
      data.checklist[slug] = {
        ...entry,
        sub_tasks: (entry.sub_tasks ?? []).filter((t) => t.id !== taskId),
      }
    })
  },

  toggleSubTask: (slug, taskId) => {
    get().patchUserData((data) => {
      const entry = data.checklist[slug]
      if (!entry) return
      const today = new Date().toISOString().split('T')[0]
      data.checklist[slug] = {
        ...entry,
        sub_tasks: (entry.sub_tasks ?? []).map((t) => {
          if (t.id !== taskId) return t
          const done = !t.done
          return { ...t, done, done_at: done ? today : null }
        }),
      }
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
