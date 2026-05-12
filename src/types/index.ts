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
  | 'researching'
  | 'complete'
  | 'at_risk'
  | 'revoked'
  | 'policy_blocked'
  | 'skipped'
  | 'not_applicable'
  | 'cant_right_now'

// Why the intent holds: was chosen by the user (update vs not_applicable/not_wanted/unknown).
// Items the user has never interacted with get no ChecklistEntry — silence isn't a choice.
// Default for existing entries without an intent field is 'update' (see storage migration).
export type ItemIntent = 'update' | 'not_applicable' | 'not_wanted' | 'unknown'

// Per-item timing. Orthogonal to status and intent. `unsure` is for things the
// user has feelings about but isn't ready to confront — surfaces as gentle
// later-nudges rather than active work. `null` means no opinion expressed.
export type ItemPriority = 'now' | 'soon' | 'someday' | 'unsure'

// State of a real-world document — separate from the user's progress on the
// item ("am I done filing the paperwork"). `name_status` and `marker_status`
// describe what's printed on the document right now. `in_progress` means an
// application has been submitted but the new document hasn't arrived.
export type DocFieldStatus = 'old' | 'new' | 'in_progress' | 'unknown'

// Polymorphic document state. The `kind` discriminator keeps the data shape
// honest: name-only items don't store a marker_status, and full-document
// items capture both.
export type DocumentState =
  | {
      kind: 'name'
      name_status: DocFieldStatus
      issued: string | null          // YYYY-MM-DD when current doc was issued
      expiration_date: string | null // YYYY-MM-DD when it expires (if applicable)
    }
  | {
      kind: 'marker'
      marker_status: DocFieldStatus
      issued: string | null
    }
  | {
      kind: 'full'
      name_status: DocFieldStatus
      marker_status: DocFieldStatus
      issued: string | null
      expiration_date: string | null
    }

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
  // Where the user was born — drives birth certificate items and similar.
  // Distinct from `jurisdiction` (current residence) because the two are
  // frequently different and have independent procedural implications.
  birth_jurisdiction?: { country: string | null; region: string | null } | null
  // Prior residences, immigration history, anywhere else with documents
  // that may need updating. Always optional, free to leave empty.
  other_jurisdictions?: { country: string | null; region: string | null }[]
  documents_obtained: string[]
  // Explicit "I don't have any of these" response from Step 4. Distinct from
  // documents_obtained being empty because the user skipped the step entirely.
  // Mutually exclusive with documents_obtained being non-empty.
  documents_response: 'none' | 'not_sure' | null
  started_at: string | null
  // Wizard position when onboarding is in progress; null when never started
  // or when onboarding is complete. Used for resume-from-where-you-left-off.
  onboarding_step: number | null
  // Snapshot of the user's broad-direction answers from the onboarding aspiration
  // step. Map of aspiration slug → priority. Persists across wizard reloads
  // and survives onboarding completion so Settings can show the user their
  // own previous answers. Always editable later.
  onboarding_aspirations?: Record<string, ItemPriority>
  // Aspirations the bulk-intent step has already processed (prefilled items
  // or spawned skeletons for). Prevents re-applying on every render.
  onboarding_aspirations_applied?: string[]
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
  intent?: ItemIntent      // defaults to 'update' when absent (migration path)
  // Timing — when the user expects to engage with this. Null = no opinion.
  // `unsure` surfaces in soft sections for gentle later-nudges.
  priority?: ItemPriority | null
  // YYYY-MM-DD; quiet dashboard surfacing on/after this date as a "you wanted
  // to revisit this" hint. Often set automatically when priority is 'someday'
  // or 'unsure', but always user-editable.
  revisit_at?: string | null
  // Per-item jurisdiction override. Defaults to the right one based on item
  // type (birth cert → birth_jurisdiction; current ID → residence). Lets users
  // with prior residences or immigration history capture which jurisdiction
  // applies to each task without affecting the rest of their checklist.
  jurisdiction_override?: { country: string | null; region: string | null } | null
  // Real-world state of the document — independent of work-progress status.
  // Polymorphic by item kind. Drives flow branching (pre/post-transition
  // process steps).
  document_state?: DocumentState | null
  completed_at: string | null
  at_risk_since?: string | null
  at_risk_reason?: string | null
  at_risk_kb_ref?: string | null
  revoked_at?: string | null
  revoked_reason?: string | null
  due_date?: string | null   // YYYY-MM-DD deadline (user-set)
  event_date?: string | null // YYYY-MM-DD scheduled appointment
  blockers: Blocker[]
  notes: string
  custom_fields: Record<string, unknown>
  status_log?: StatusLogEntry[]
  sub_tasks: SubTask[]
}

// ── Custom Item ───────────────────────────────────────────────────────────────

// How a custom item came into existence. Most are user-created from scratch
// ('user_created'). 'aspiration_skeleton' marks items the app generated when
// the user expressed broad intent (e.g. "legal name change") but the KB had
// no jurisdiction-matched pathway — so the app dropped in a generic skeleton
// the user fills in and (optionally) contributes back.
export type CustomItemProvenance = 'user_created' | 'aspiration_skeleton'

export interface CustomItem {
  id: string
  label: string
  description?: string
  category: string
  track: string
  status: ItemStatus  // legacy — source of truth is checklist[id].status
  notes: string       // legacy — source of truth is checklist[id].notes
  provenance?: CustomItemProvenance
  // For aspiration_skeleton items: the aspiration slug that spawned it.
  // Lets us group them and offer contribution hooks per-aspiration later.
  aspiration_slug?: string
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
  start_date?: string | null    // YYYY-MM-DD; fixed-mode anchor when never logged (e.g. alternating injection days)
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
