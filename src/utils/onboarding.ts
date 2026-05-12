// Helpers used by the onboarding wizard. Pure read-only logic — no store
// access. The store calls these and applies the results.

import type { DocumentState, ItemPriority, KBCache, KBItem, UserData } from '../types'

export const TOTAL_STEPS = 10
export const FIRST_STEP = 1

export function isValidStep(step: number): boolean {
  return Number.isInteger(step) && step >= FIRST_STEP && step <= TOTAL_STEPS
}

export function clampStep(step: number): number {
  if (!Number.isFinite(step)) return FIRST_STEP
  return Math.max(FIRST_STEP, Math.min(TOTAL_STEPS, Math.trunc(step)))
}

// ── Documents the wizard offers in Step 4 ─────────────────────────────────────
//
// Stored on UserProfile.documents_obtained as an array of these slugs.
// ordering.ts treats these as members of the satisfied set, so KB items whose
// `requires` field contains any of these slugs become available immediately.

export const ONBOARDING_DOCUMENT_KEYS = [
  'court-order',
  'birth-certificate',
  'social-security',
  'photo-id',
] as const

export type OnboardingDocumentKey = (typeof ONBOARDING_DOCUMENT_KEYS)[number]

// ── Step 4 document-state capture ─────────────────────────────────────────────
//
// Per-item registry of which items we'll ask about during the document-state
// step, and what shape of state applies to each. Kept short — we only ask about
// items the user is likely to actually have and where the state meaningfully
// changes the displayed flow. Users can capture state for other items in
// Settings or on the item detail page; this list is just the opinionated
// onboarding default.

export interface DocStateItemConfig {
  slug: string
  kind: DocumentState['kind']
  // KB items we expect to model this slug against. If the KB doesn't have it,
  // we silently skip the row rather than show a broken option.
  // Country/region filter to only ask when relevant.
  jurisdiction?: { country: string; region?: string }
}

export const ONBOARDING_DOC_STATE_ITEMS: DocStateItemConfig[] = [
  { slug: 'ssa-name', kind: 'name', jurisdiction: { country: 'US' } },
  { slug: 'ssa-marker', kind: 'marker', jurisdiction: { country: 'US' } },
  { slug: 'us-passport-name', kind: 'name', jurisdiction: { country: 'US' } },
  { slug: 'us-passport-marker', kind: 'marker', jurisdiction: { country: 'US' } },
  { slug: 'us-passport-card-name', kind: 'name', jurisdiction: { country: 'US' } },
  { slug: 'us-passport-card-marker', kind: 'marker', jurisdiction: { country: 'US' } },
  { slug: 'il-dl', kind: 'full', jurisdiction: { country: 'US', region: 'IL' } },
  { slug: 'il-birth-cert', kind: 'full', jurisdiction: { country: 'US', region: 'IL' } },
  { slug: 'irs-marker', kind: 'marker', jurisdiction: { country: 'US' } },
  { slug: 'fsa-id', kind: 'name', jurisdiction: { country: 'US' } },
]

// Filter the registry to items that (a) exist in the KB and (b) match the
// user's jurisdiction. Returns an empty array if KB is unloaded.
export function getApplicableDocStateItems(
  kb: KBCache | null,
  jurisdiction: { country: string | null; region: string | null },
  birth_jurisdiction?: { country: string | null; region: string | null } | null
): { config: DocStateItemConfig; item: KBItem }[] {
  if (!kb) return []
  const countries = new Set<string>()
  if (jurisdiction.country) countries.add(jurisdiction.country)
  if (birth_jurisdiction?.country) countries.add(birth_jurisdiction.country)

  const regions = new Set<string>()
  if (jurisdiction.region) regions.add(jurisdiction.region)
  if (birth_jurisdiction?.region) regions.add(birth_jurisdiction.region)

  const matches: { config: DocStateItemConfig; item: KBItem }[] = []
  for (const config of ONBOARDING_DOC_STATE_ITEMS) {
    const item = kb.items[config.slug]
    if (!item) continue
    if (config.jurisdiction) {
      // Country must match (if user gave one) OR be unset (allow showing).
      if (countries.size > 0 && !countries.has(config.jurisdiction.country)) continue
      // Region-specific: only show if the user's residence or birth matches.
      if (
        config.jurisdiction.region &&
        regions.size > 0 &&
        !regions.has(config.jurisdiction.region)
      ) {
        continue
      }
    }
    matches.push({ config, item })
  }
  return matches
}

// Default document_state for an item kind — everything `unknown`, no dates.
// Used when the user opts in to capturing state but hasn't filled anything yet.
export function defaultDocumentState(kind: DocumentState['kind']): DocumentState {
  if (kind === 'name') {
    return { kind: 'name', name_status: 'unknown', issued: null, expiration_date: null }
  }
  if (kind === 'marker') {
    return { kind: 'marker', marker_status: 'unknown', issued: null }
  }
  return {
    kind: 'full',
    name_status: 'unknown',
    marker_status: 'unknown',
    issued: null,
    expiration_date: null,
  }
}

// ── Step 7 broad-direction aspirations ────────────────────────────────────────
//
// Aspirations describe what the user wants to do at a high level — independent
// of jurisdiction-specific KB items. Each aspiration maps to zero or more KB
// item slugs that implement it. When the user expresses an aspiration and the
// KB has a jurisdiction-matched implementation, those items get pre-marked in
// Step 8. When the KB has no match, we create a skeleton custom item the user
// fills in and can contribute back.
//
// Keep the list short. This is "what shape of life-change," not a category
// taxonomy.

export interface Aspiration {
  slug: string
  // Used to pull i18n strings: onboarding.steps.direction.aspirations.<i18n_key>.*
  i18n_key: string
  // KB items that implement this aspiration. Use slugs that exist or might
  // exist; missing ones are silently ignored when prefilling Step 8.
  implementing_slugs: string[]
  // Track this aspiration falls under — used to filter out aspirations the
  // user hasn't opted into via active_tracks.
  track: string
  // Default category for skeleton items spawned for non-modeled jurisdictions.
  skeleton_category: string
  // Default sub-tasks for skeleton items — broad-strokes, jurisdiction-free.
  skeleton_steps: string[]
}

export const ASPIRATIONS: Aspiration[] = [
  {
    slug: 'legal-name-change',
    i18n_key: 'legal_name_change',
    implementing_slugs: ['il-legal-name', 'ssa-name', 'us-passport-name', 'us-passport-card-name', 'fsa-id', 'irs-name'],
    track: 'legal',
    skeleton_category: 'legal-name',
    skeleton_steps: [
      'Find the court, registry, or office in your area that handles legal name changes',
      'Gather required documents (typically an ID, proof of residence, and any filing fees)',
      'Submit the petition or application',
      'Wait for a hearing, decision, or processing window',
      'Receive the court order, decree, or equivalent record',
      'Use the new record to update other documents (IDs, accounts, employer, etc.)',
    ],
  },
  {
    slug: 'gender-marker-change',
    i18n_key: 'gender_marker_change',
    implementing_slugs: ['il-dl', 'ssa-marker', 'us-passport-marker', 'us-passport-card-marker', 'irs-marker'],
    track: 'legal',
    skeleton_category: 'identification',
    skeleton_steps: [
      'Check what the issuing agency currently requires (medical letter, court order, self-attestation, etc.)',
      'Confirm whether the marker you want is currently available in your jurisdiction',
      'Gather any required documentation',
      'Submit the application or request',
      'Track the change through whatever channels your agency uses',
    ],
  },
  {
    slug: 'birth-certificate-update',
    i18n_key: 'birth_certificate_update',
    implementing_slugs: ['il-birth-cert'],
    track: 'legal',
    skeleton_category: 'vital-records',
    skeleton_steps: [
      'Find the vital records office where you were born',
      'Check what they require to amend or reissue a birth certificate',
      'Submit the request with required documentation',
      'Wait for processing and the updated record to arrive',
    ],
  },
  {
    slug: 'medical-transition',
    i18n_key: 'medical_transition',
    implementing_slugs: [],
    track: 'medical',
    skeleton_category: 'medical-care',
    skeleton_steps: [
      'Find a provider you trust (informed-consent clinic, primary care, or specialist)',
      'Discuss options, goals, and what feels right for you',
      'Get any baseline labs or evaluations the provider recommends',
      'Decide on next steps at your own pace',
    ],
  },
  {
    slug: 'social-name-use',
    i18n_key: 'social_name_use',
    implementing_slugs: [],
    track: 'social',
    skeleton_category: 'social-name',
    skeleton_steps: [
      'Choose where and with whom to start using your name',
      'Try it on in low-stakes contexts first if helpful',
      'Update accounts and contacts when you feel ready',
    ],
  },
  {
    slug: 'finding-a-name',
    i18n_key: 'finding_a_name',
    implementing_slugs: ['find-a-name'],
    track: 'social',
    skeleton_category: 'social-name',
    skeleton_steps: [
      'Decide on a cultural feel (masculine, feminine, unisex, nonbinary, something else)',
      'Look at names you were almost given, family names, names that feel right',
      'Try names on in private first',
      'Try one on with a trusted person',
    ],
  },
  {
    slug: 'accounts-and-services',
    i18n_key: 'accounts_and_services',
    implementing_slugs: [],
    track: 'personal',
    skeleton_category: 'accounts',
    skeleton_steps: [
      'List the accounts that hold your name or marker',
      'Update each as you have the underlying documents to do so',
    ],
  },
  {
    slug: 'workplace-update',
    i18n_key: 'workplace_update',
    implementing_slugs: [],
    track: 'social',
    skeleton_category: 'workplace',
    skeleton_steps: [
      'Decide what you want updated at work (name, pronouns, presentation)',
      'Identify who needs to know to make those changes happen',
      'Decide on timing that feels right',
    ],
  },
]

// All priority values shown in the broad-direction step. `null` (no opinion)
// is also valid in storage, but the picker uses these explicit values.
export const PRIORITY_VALUES: ItemPriority[] = ['now', 'soon', 'someday', 'unsure']

// Resolve an aspiration against the KB and jurisdiction.
// Returns the KB slugs the bulk picker should pre-mark with intent=update +
// the given priority, plus a flag indicating whether the KB had any matches
// (used to decide whether to spawn a skeleton custom item).
export interface AspirationResolution {
  aspiration: Aspiration
  priority: ItemPriority
  matched_kb_slugs: string[]
  has_kb_match: boolean
}

export function resolveAspirations(
  aspirations: Record<string, ItemPriority>,
  kb: KBCache | null,
  jurisdiction: { country: string | null; region: string | null }
): AspirationResolution[] {
  const results: AspirationResolution[] = []
  for (const [aspirationSlug, priority] of Object.entries(aspirations)) {
    const aspiration = ASPIRATIONS.find((a) => a.slug === aspirationSlug)
    if (!aspiration) continue

    const matched: string[] = []
    if (kb) {
      for (const slug of aspiration.implementing_slugs) {
        const item = kb.items[slug]
        if (!item) continue
        const itemCountry = item.jurisdiction?.country
        // No country on item means global — always matches.
        // Country on user not set means we can't filter — include defensively.
        if (!itemCountry || !jurisdiction.country || itemCountry === jurisdiction.country) {
          matched.push(slug)
        }
      }
    }

    results.push({
      aspiration,
      priority,
      matched_kb_slugs: matched,
      has_kb_match: matched.length > 0,
    })
  }
  return results
}

// ── Step 7 categories grouping ────────────────────────────────────────────────

export interface CategoryGroup {
  trackSlug: string
  trackLabel: string
  trackSortOrder: number
  categories: {
    categorySlug: string
    categoryLabel: string
    categorySortOrder: number
    items: KBItem[]
  }[]
}

/**
 * Group KB items by track → category for the Step 7 walkthrough. Filtered to
 * the user's `active_tracks`, then to the user's jurisdiction (country match,
 * with global items always included). Returns a stable, sorted structure.
 *
 * If `active_tracks` is empty (user skipped Step 2), all tracks are included.
 */
export function groupItemsByTrackAndCategory(
  kb: KBCache,
  activeTracks: string[],
  jurisdiction: { country: string | null; region: string | null }
): CategoryGroup[] {
  const trackFilter = activeTracks.length > 0 ? new Set(activeTracks) : null

  const matchesJurisdiction = (item: KBItem): boolean => {
    const itemCountry = item.jurisdiction?.country
    if (!itemCountry) return true
    if (!jurisdiction.country) return true
    return itemCountry === jurisdiction.country
  }

  const itemsByCategory = new Map<string, KBItem[]>()
  for (const item of Object.values(kb.items)) {
    if (trackFilter && !trackFilter.has(item.track)) continue
    if (!matchesJurisdiction(item)) continue
    const list = itemsByCategory.get(item.category) ?? []
    list.push(item)
    itemsByCategory.set(item.category, list)
  }

  const groupsByTrack = new Map<string, CategoryGroup>()
  for (const [categorySlug, items] of itemsByCategory.entries()) {
    const category = kb.categories[categorySlug]
    if (!category) continue
    const track = kb.tracks[category.track]
    if (!track) continue
    if (trackFilter && !trackFilter.has(track.slug)) continue

    let group = groupsByTrack.get(track.slug)
    if (!group) {
      group = {
        trackSlug: track.slug,
        trackLabel: track.label,
        trackSortOrder: track.sort_order,
        categories: [],
      }
      groupsByTrack.set(track.slug, group)
    }

    items.sort((a, b) => a.label.localeCompare(b.label))
    group.categories.push({
      categorySlug: category.slug,
      categoryLabel: category.label,
      categorySortOrder: category.sort_order,
      items,
    })
  }

  const groups = Array.from(groupsByTrack.values())
  for (const g of groups) {
    g.categories.sort((a, b) => a.categorySortOrder - b.categorySortOrder)
  }
  groups.sort((a, b) => a.trackSortOrder - b.trackSortOrder)

  return groups
}

// ── Step 9 danger flag scan ───────────────────────────────────────────────────

export interface DangerFlag {
  slug: string
  label: string
  /** From `gender_marker_change.status` — 'danger' or 'unavailable'. */
  status: 'danger' | 'unavailable'
  note: string | null
  /** Why this surfaced for the user — short phrase, already in their voice. */
  reason: string
}

/**
 * Items the user should be aware of given the profile they just built.
 *
 * Surface conditions:
 *
 *   1. The item's `gender_marker_change.status` is `danger` or `unavailable`,
 *      AND the user indicated they are changing their gender marker (in
 *      `change_types`).
 *   2. The item is in the user's jurisdiction (country match, or global).
 *   3. The user has the item on their list (in their checklist or has marked
 *      a parent track active and the item is in that track).
 *
 * The point is a small, specific list — not every item flagged in the KB.
 */
export function findDangerFlags(kb: KBCache, userData: UserData): DangerFlag[] {
  const profile = userData.profile
  const changingMarker = profile.change_types.includes('gender_marker')
  if (!changingMarker) return []

  const userCountry = profile.jurisdiction.country
  const activeTracks = new Set(profile.active_tracks)
  const onChecklist = new Set(Object.keys(userData.checklist))

  const flags: DangerFlag[] = []
  for (const item of Object.values(kb.items)) {
    const gmc = item.gender_marker_change
    if (!gmc?.applies) continue
    if (gmc.status !== 'danger' && gmc.status !== 'unavailable') continue

    const itemCountry = item.jurisdiction?.country
    if (itemCountry && userCountry && itemCountry !== userCountry) continue

    const relevantToChecklist = onChecklist.has(item.slug)
    const relevantToTrack = activeTracks.size === 0 || activeTracks.has(item.track)
    if (!relevantToChecklist && !relevantToTrack) continue

    flags.push({
      slug: item.slug,
      label: item.label,
      status: gmc.status,
      note: gmc.status_note,
      reason:
        gmc.status === 'danger'
          ? 'Gender marker changes here are currently a risk area.'
          : 'Gender marker changes here are not currently available.',
    })
  }

  flags.sort((a, b) => a.label.localeCompare(b.label))
  return flags
}
