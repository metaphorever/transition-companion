// Helpers used by the onboarding wizard. Pure read-only logic — no store
// access. The store calls these and applies the results.

import type { KBCache, KBItem, UserData } from '../types'

export const TOTAL_STEPS = 9
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
