// ── Tracks ────────────────────────────────────────────────────────────────────

export interface Track {
  slug: string
  label: string
  description: string
  sort_order: number
}

// ── Categories ────────────────────────────────────────────────────────────────

export interface Category {
  slug: string
  label: string
  description: string
  track: string
  icon_key: string
  sort_order: number
  tags: string[]
}

// ── Items (KB) ────────────────────────────────────────────────────────────────

export type ItemImportance = 'critical' | 'high' | 'medium' | 'low'
export type PresenceLevel = 'just_the_path' | 'some_guidance' | 'walk_with_me'
export type ProcessMode = 'online' | 'in_person' | 'mail' | 'phone' | 'preparation'
export type GenderMarkerStatus = 'current' | 'caution' | 'danger' | 'unavailable' | 'varies' | 'unknown'

export interface ProcessStep {
  step: number
  description: string
  modes: ProcessMode[]
  note: string | null
}

export interface AccessRequirements {
  internet: 'required' | 'optional' | false
  printer: 'required' | 'optional' | false
  phone: boolean
  copies: boolean
  notary: boolean
  travel_required: boolean
  travel_note: string | null
}

export interface GenderMarkerChange {
  applies: boolean
  status: GenderMarkerStatus
  status_note: string | null
  status_date: string | null
  markers_historically_available: string[]
  markers_currently_available: string[]
  advocacy_links: { label: string; url: string }[]
}

export interface ItemProcess {
  summary: string
  steps: ProcessStep[]
  documents_required: string[]
  modes_available: ProcessMode[]
  access_requirements: AccessRequirements
  cost: string | null
  estimated_time_days: string | null
  url_official: string | null
  url_info: string | null
  notes: string | null
}

export interface PresenceLevelContent {
  some_guidance: string | null
  walk_with_me: string | null
}

export interface Source {
  url: string
  label: string
  retrieved: string
}

export interface KBItem {
  slug: string
  label: string
  category: string
  track: string
  subcategory: string | null
  description: string
  importance: ItemImportance
  jurisdiction: { country: string | null; region: string | null }
  requires: string[]
  required_by: string[]
  immutable: boolean
  immutable_note: string | null
  immutable_compassion_note: string | null
  workarounds: string[]
  process: ItemProcess | null
  gender_marker_change: GenderMarkerChange | null
  discrimination_notes: string | null
  presence_level_content: PresenceLevelContent
  last_verified: string
  verified_by: string
  sources: Source[]
  // Slugs of other KB items that become relevant when this item hits at_risk or revoked.
  // UI surfaces these as "you may want to look at" — user decides whether to add them.
  // Optional: not all items have recovery paths.
  recovery_items?: string[]
}

// ── Sequences ─────────────────────────────────────────────────────────────────

export interface SequencePhase {
  phase: number
  label: string
  description?: string
  items: string[]
  note?: string
}

export interface Sequence {
  slug: string
  label: string
  description: string
  track: string
  jurisdiction: string
  phases: SequencePhase[]
}

// ── Jurisdictions ─────────────────────────────────────────────────────────────

export interface JurisdictionItemOverride {
  label?: string
  url_official?: string
  process_override?: Partial<ItemProcess> & {
    gender_marker_change?: Partial<GenderMarkerChange> & {
      markers_available?: string[]
      process_note?: string
    }
  }
}

export interface Jurisdiction {
  jurisdiction: { country: string; region: string | null }
  label: string
  item_overrides: Record<string, JurisdictionItemOverride>
  region_specific_items: string[]
}

// ── User Data ─────────────────────────────────────────────────────────────────

export type ItemStatus =
  | 'not_started'
  | 'in_progress'
  | 'complete'
  | 'at_risk'
  | 'revoked'
  | 'skipped'
  | 'not_applicable'
  | 'cant_right_now'

export type HousingStatus =
  | 'independent'
  | 'living_with_family_or_others'
  | 'transitional_or_unstable'
  | 'prefer_not_to_say'

export type WorkplaceSafety =
  | 'out_and_supported'
  | 'out_but_complicated'
  | 'not_out_at_work'
  | 'not_employed'
  | 'prefer_not_to_say'

export type OverallFlexibility = 'a_lot' | 'some' | 'not_much' | 'varies'
export type Transportation =
  | 'car'
  | 'public_transit'
  | 'ride_share'
  | 'limited'
  | 'prefer_not_to_say'

export interface UserSafety {
  housing_status: HousingStatus | null
  housing_note: string | null
  out_to_household: boolean | null
  household_supportive: boolean | null
  shared_accounts: boolean | null
  shared_devices: boolean | null
  workplace_safety: WorkplaceSafety | null
  overall_flexibility: OverallFlexibility | null
  safety_note: string
}

export interface UserAccess {
  internet_home: boolean
  internet_public_only: boolean
  printer_home: boolean
  printer_access: boolean
  printer_access_note: string
  copier_access: boolean
  phone_reliable: boolean
  video_call_capable: boolean
  transportation: Transportation | null
  transportation_note: string
}

export interface UserPresence {
  overall_level: PresenceLevel
  open_doors: boolean
  per_track: Record<string, PresenceLevel>
}

export type ContributorPrivacyLevel = 'manual' | 'always_include' | 'never_include'
export type ContributorPromptingLevel = 'contextual' | 'proactive' | 'off'
export type ContributorInvolvementLevel = 'observer' | 'reporter' | 'contributor'

export interface ContributorSettings {
  privacy_level: ContributorPrivacyLevel
  prompting_level: ContributorPromptingLevel
  involvement_level: ContributorInvolvementLevel
  github_connected: boolean
}

export interface UserProfile {
  display_name: string | null
  chosen_name: string | null
  pronouns: string | null
  pronouns_other: string | null
  name_status: string | null
  change_types: string[]
  gender_marker_target: string | null
  active_tracks: string[]
  safety: UserSafety
  out_contexts: {
    close_friends: boolean | null
    partner: boolean | null
    family: boolean | null
    work: boolean | null
    publicly: boolean | null
  }
  jurisdiction: { country: string | null; region: string | null }
  documents_obtained: string[]
  // Explicit "I don't have any of these" response from Step 4. Distinct from
  // documents_obtained being empty because the user skipped the step entirely.
  // Mutually exclusive with documents_obtained being non-empty.
  documents_response: 'none' | 'not_sure' | null
  started_at: string | null
  // Wizard position when onboarding is in progress; null when never started
  // or when onboarding is complete. Used for resume-from-where-you-left-off.
  onboarding_step: number | null
  access: UserAccess
  presence: UserPresence
  contributor_settings: ContributorSettings
}

// ── Blocker ───────────────────────────────────────────────────────────────────

export type BlockerType =
  | 'document'
  | 'legal'
  | 'access'
  | 'safety'
  | 'relationship'
  | 'readiness'
  | 'waiting'
  | 'custom'

export type BlockerResolvable =
  | 'yes'
  | 'no'
  | 'maybe'
  | 'eventually'
  | 'unknown'

export type BlockerSeverity =
  | 'minor'
  | 'moderate'
  | 'significant'
  | 'absolute'

export interface Blocker {
  id: string
  type: BlockerType
  label: string
  kb_dependency?: string
  person_ref?: string
  user_defined: boolean
  severity?: BlockerSeverity
  resolvable: BlockerResolvable
  resolvable_note?: string
  workaround_available: boolean
  workaround_note?: string
  suppress_workaround?: boolean
}

// ── Checklist Entry ───────────────────────────────────────────────────────────

export interface StatusLogEntry {
  status: ItemStatus
  at: string        // ISO date string (date-only, YYYY-MM-DD)
  note?: string | null
  reason?: string | null
}

export interface SubTask {
  id: string
  label: string
  done: boolean
  done_at: string | null
  note: string | null
  due_date: string | null  // YYYY-MM-DD; past due_date surfaces a quiet flag on item cards
}

export interface ChecklistEntry {
  status: ItemStatus
  completed_at: string | null
  at_risk_since?: string | null
  at_risk_reason?: string | null
  at_risk_kb_ref?: string | null
  revoked_at?: string | null
  revoked_reason?: string | null
  blockers: Blocker[]
  notes: string
  custom_fields: Record<string, unknown>
  status_log?: StatusLogEntry[]
  sub_tasks: SubTask[]
}

// ── Custom Item ───────────────────────────────────────────────────────────────

export interface CustomItem {
  id: string
  label: string
  category: string
  track: string
  status: ItemStatus
  notes: string
}

// ── Person ────────────────────────────────────────────────────────────────────

export type SafetyLevel =
  | 'safe'
  | 'probably_safe'
  | 'unsure'
  | 'probably_unsafe'
  | 'unsafe'
  | 'unknown'

export type SupportLevel =
  | 'fully_supportive'
  | 'supportive_with_effort'
  | 'words_not_actions'
  | 'neutral'
  | 'resistant'
  | 'actively_hostile'
  | 'unknown'

export type ContactFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'holidays_only'
  | 'rarely'
  | 'estranged'

export interface Person {
  id: string
  label: string
  relationship: string
  out_to: boolean
  out_status: string
  safety_level: SafetyLevel
  safety_note: string
  support_level: SupportLevel | null
  support_note: string | null
  contact_frequency: ContactFrequency | null
  items_they_need_to_update: string[]
  user_notes: string
}

// ── Recurring Items ───────────────────────────────────────────────────────────

// Three modes on a single type — transitions naturally as the user's situation solidifies.
// fixed: next due = last_logged_at + interval_days (pure arithmetic)
// manual: user sets next_date each time they log/book
// open: standing intention, no dates, never marked overdue
export type RecurringItemMode = 'fixed' | 'manual' | 'open'

export interface RecurringItem {
  id: string
  label: string
  mode: RecurringItemMode
  interval_days: number | null  // used by fixed; optional nudge for manual
  next_date: string | null      // YYYY-MM-DD; stored for manual mode, null for fixed/open
  last_logged_at: string | null // YYYY-MM-DD; set when user logs completion
  track: string
  notes: string
}

// ── Root UserData ─────────────────────────────────────────────────────────────

export interface UserData {
  version: string
  created_at: string
  profile: UserProfile
  checklist: Record<string, ChecklistEntry>
  custom_items: CustomItem[]
  recurring_items: RecurringItem[]
  people: Record<string, Person>
}

// ── KB Cache ──────────────────────────────────────────────────────────────────

export interface KBCache {
  fetched_at: string
  items: Record<string, KBItem>
  categories: Record<string, Category>
  tracks: Record<string, Track>
  sequences: Record<string, Sequence>
  jurisdictions: Record<string, Jurisdiction>
}
