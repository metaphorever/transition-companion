import type { UserData, KBCache } from '../types'

const USER_DATA_KEY = 'tc_user_data'
const KB_CACHE_KEY = 'tc_kb_cache'

const DEFAULT_USER_DATA: UserData = {
  version: '1.0',
  created_at: new Date().toISOString(),
  profile: {
    display_name: null,
    chosen_name: null,
    pronouns: null,
    pronouns_other: null,
    name_status: null,
    change_types: [],
    gender_marker_target: null,
    active_tracks: [],
    safety: {
      housing_status: null,
      housing_note: null,
      out_to_household: null,
      household_supportive: null,
      shared_accounts: null,
      shared_devices: null,
      workplace_safety: null,
      overall_flexibility: null,
      safety_note: '',
    },
    out_contexts: {
      close_friends: null,
      partner: null,
      family: null,
      work: null,
      publicly: null,
    },
    jurisdiction: { country: null, region: null },
    birth_jurisdiction: null,
    other_jurisdictions: [],
    documents_obtained: [],
    documents_response: null,
    started_at: null,
    onboarding_step: null,
    access: {
      internet_home: true,
      internet_public_only: false,
      printer_home: false,
      printer_access: false,
      printer_access_note: '',
      copier_access: false,
      phone_reliable: false,
      video_call_capable: false,
      transportation: null,
      transportation_note: '',
    },
    presence: {
      overall_level: 'some_guidance',
      open_doors: false,
      per_track: {},
    },
    contributor_settings: {
      privacy_level: 'manual',
      prompting_level: 'contextual',
      involvement_level: 'observer',
      github_connected: false,
    },
  },
  checklist: {},
  custom_items: [],
  recurring_items: [],
  people: {},
}

export function readUserData(): UserData {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY)
    if (!raw) return structuredClone(DEFAULT_USER_DATA)
    const parsed = JSON.parse(raw) as UserData
    return mergeWithDefaults(parsed)
  } catch {
    return structuredClone(DEFAULT_USER_DATA)
  }
}

// Fill in any fields a stored UserData blob is missing — e.g. an export from
// an older app version. Only top-level profile keys are merged; nested objects
// (safety, access, etc.) get the stored value or the default wholesale.
// Exported for unit tests; runtime callers use readUserData()/importUserData().
export function mergeWithDefaults(stored: UserData): UserData {
  const defaults = structuredClone(DEFAULT_USER_DATA)
  const profile = { ...defaults.profile, ...(stored.profile ?? {}) }
  for (const key of ['safety', 'out_contexts', 'jurisdiction', 'access', 'presence', 'contributor_settings'] as const) {
    profile[key] = {
      ...(defaults.profile[key] as object),
      ...((stored.profile?.[key] as object) ?? {}),
    } as never
  }

  // Migrate checklist entries: back-fill intent for entries that predate the field
  const checklist = { ...(stored.checklist ?? {}) }
  for (const key of Object.keys(checklist)) {
    const entry = checklist[key]
    if (entry && !entry.intent) {
      checklist[key] = { ...entry, intent: 'update' as const }
    }
  }

  // Phase 13: rename us-passport → us-passport-name; us-passport-card → us-passport-card-name.
  // Also seed policy_blocked marker entries for users who had progress on the source items.
  const MARKER_MIGRATIONS: Array<{ oldSlug: string; nameSlug: string; markerSlug: string }> = [
    { oldSlug: 'us-passport',      nameSlug: 'us-passport-name',      markerSlug: 'us-passport-marker' },
    { oldSlug: 'us-passport-card', nameSlug: 'us-passport-card-name', markerSlug: 'us-passport-card-marker' },
  ]
  for (const { oldSlug, nameSlug, markerSlug } of MARKER_MIGRATIONS) {
    if (checklist[oldSlug] && !checklist[nameSlug]) {
      checklist[nameSlug] = checklist[oldSlug]
      delete checklist[oldSlug]
    }
    // Seed a policy_blocked marker entry if the user had any engagement with the name item
    const nameEntry = checklist[nameSlug]
    if (nameEntry && !checklist[markerSlug]) {
      checklist[markerSlug] = {
        status: 'policy_blocked',
        intent: 'update' as const,
        completed_at: null,
        blockers: [],
        notes: '',
        custom_fields: {},
        sub_tasks: [],
      }
    }
  }
  // SSA marker: seed policy_blocked entry if user has an ssa-name entry
  if (checklist['ssa-name'] && !checklist['ssa-marker']) {
    checklist['ssa-marker'] = {
      status: 'policy_blocked',
      intent: 'update' as const,
      completed_at: null,
      blockers: [],
      notes: '',
      custom_fields: {},
      sub_tasks: [],
    }
  }

  // Migrate custom items: ensure every custom item has a ChecklistEntry
  const custom_items = stored.custom_items ?? []
  for (const c of custom_items) {
    if (!checklist[c.id]) {
      checklist[c.id] = {
        status: c.status ?? 'not_started',
        intent: 'update' as const,
        completed_at: null,
        blockers: [],
        notes: c.notes ?? '',
        custom_fields: {},
        sub_tasks: [],
      }
    }
  }

  return {
    ...defaults,
    ...stored,
    profile,
    checklist,
    custom_items,
    recurring_items: stored.recurring_items ?? [],
    people: stored.people ?? {},
  }
}

export function writeUserData(data: UserData): void {
  try {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Could not save your data. Your device storage may be full.', e)
  }
}

export function updateUserData(patch: (data: UserData) => UserData | void): UserData {
  const current = readUserData()
  const result = patch(current)
  const next = result ?? current
  writeUserData(next)
  return next
}

export function exportUserData(): string {
  const data = readUserData()
  return JSON.stringify(data, null, 2)
}

export function importUserData(json: string): { ok: boolean; error?: string } {
  try {
    const parsed = JSON.parse(json)
    if (!parsed.version || !parsed.profile || !parsed.checklist) {
      return { ok: false, error: 'This file does not look like a Transition Companion export.' }
    }
    writeUserData(parsed as UserData)
    return { ok: true }
  } catch {
    return { ok: false, error: 'The file could not be read. Check that it is valid JSON.' }
  }
}

export function clearUserData(): void {
  localStorage.removeItem(USER_DATA_KEY)
}

export function hasUserData(): boolean {
  return localStorage.getItem(USER_DATA_KEY) !== null
}

// ── KB Cache ──────────────────────────────────────────────────────────────────

export function readKBCache(): KBCache | null {
  try {
    const raw = localStorage.getItem(KB_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<KBCache>
    // Pre-Phase-15 caches lack the `conditions` key. Fill it in so the
    // KBCache contract holds for downstream consumers.
    if (!parsed.conditions) parsed.conditions = {}
    return parsed as KBCache
  } catch {
    return null
  }
}

export function writeKBCache(cache: KBCache): void {
  try {
    localStorage.setItem(KB_CACHE_KEY, JSON.stringify(cache))
  } catch (e) {
    console.error('Could not cache knowledge base data. Your device storage may be full.', e)
  }
}

export function clearKBCache(): void {
  localStorage.removeItem(KB_CACHE_KEY)
}

export function isKBCacheValid(cache: KBCache, ttlHours = 24): boolean {
  const fetched = new Date(cache.fetched_at).getTime()
  const age = Date.now() - fetched
  return age < ttlHours * 60 * 60 * 1000
}
