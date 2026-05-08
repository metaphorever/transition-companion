import { describe, it, expect } from 'vitest'

import type {
  Blocker,
  ChecklistEntry,
  ItemImportance,
  ItemStatus,
  KBCache,
  KBItem,
  UserData,
} from '../types'

import {
  SATISFYING_STATUSES,
  buildDependencyGraph,
  computeAllAvailability,
  computeItemAvailability,
  detectCycles,
  filterAvailableNow,
  filterBlocked,
  filterCompleted,
  getSatisfiedSlugs,
  isActiveStoredBlocker,
  isSatisfying,
  itemsUnlockedBy,
  recommendStartHere,
  topologicalSort,
  transitiveDependents,
  transitiveRequirements,
} from './ordering'

// ── Fixtures ─────────────────────────────────────────────────────────────────

function mockItem(overrides: Partial<KBItem> & { slug: string }): KBItem {
  const defaults: Omit<KBItem, 'slug'> = {
    label: overrides.slug,
    category: 'government-id',
    track: 'legal',
    subcategory: null,
    description: '',
    importance: 'medium',
    jurisdiction: { country: null, region: null },
    requires: [],
    required_by: [],
    immutable: false,
    immutable_note: null,
    immutable_compassion_note: null,
    workarounds: [],
    process: null,
    gender_marker_change: null,
    discrimination_notes: null,
    presence_level_content: { some_guidance: null, walk_with_me: null },
    last_verified: '2026-01-01',
    verified_by: 'test',
    sources: [],
  }
  return { ...defaults, ...overrides }
}

function mockKB(items: KBItem[]): KBCache {
  return {
    fetched_at: '2026-01-01T00:00:00Z',
    items: Object.fromEntries(items.map((i) => [i.slug, i])),
    categories: {},
    tracks: {},
    sequences: {},
    jurisdictions: {},
  }
}

function mockUserData(overrides?: {
  checklist?: Record<string, Partial<ChecklistEntry>>
  documents_obtained?: string[]
  active_tracks?: string[]
}): UserData {
  const checklist: Record<string, ChecklistEntry> = {}
  for (const [slug, partial] of Object.entries(overrides?.checklist ?? {})) {
    checklist[slug] = {
      status: 'not_started',
      completed_at: null,
      blockers: [],
      notes: '',
      custom_fields: {},
      ...partial,
    }
  }

  return {
    version: '1.0',
    created_at: '2026-01-01T00:00:00Z',
    profile: {
      display_name: null,
      chosen_name: null,
      pronouns: null,
      pronouns_other: null,
      name_status: null,
      change_types: [],
      gender_marker_target: null,
      active_tracks: overrides?.active_tracks ?? [],
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
      documents_obtained: overrides?.documents_obtained ?? [],
      started_at: null,
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
      presence: { overall_level: 'just_the_path', open_doors: false, per_track: {} },
      contributor_settings: {
        privacy_level: 'manual',
        prompting_level: 'contextual',
        involvement_level: 'observer',
        github_connected: false,
      },
    },
    checklist,
    custom_items: [],
    people: {},
  }
}

function blocker(partial: Partial<Blocker> & { id: string; type: Blocker['type'] }): Blocker {
  const defaults: Omit<Blocker, 'id' | 'type'> = {
    label: `blocker ${partial.id}`,
    user_defined: true,
    resolvable: 'maybe',
    workaround_available: false,
  }
  return { ...defaults, ...partial }
}

// ── 1. Graph construction ────────────────────────────────────────────────────

describe('buildDependencyGraph', () => {
  it('returns empty graph for empty KB', () => {
    const g = buildDependencyGraph({})
    expect(g.slugs.size).toBe(0)
    expect(g.requires.size).toBe(0)
    expect(g.requiredBy.size).toBe(0)
    expect(g.unknownReferences.size).toBe(0)
  })

  it('builds forward and reverse edges from requires', () => {
    const g = buildDependencyGraph({
      a: mockItem({ slug: 'a', requires: ['b'] }),
      b: mockItem({ slug: 'b', requires: ['c'] }),
      c: mockItem({ slug: 'c' }),
    })
    expect([...g.requires.get('a')!]).toEqual(['b'])
    expect([...g.requires.get('b')!]).toEqual(['c'])
    expect([...g.requires.get('c')!]).toEqual([])
    expect([...g.requiredBy.get('c')!]).toEqual(['b'])
    expect([...g.requiredBy.get('b')!]).toEqual(['a'])
    expect([...g.requiredBy.get('a')!]).toEqual([])
  })

  it('merges required_by declarations into the graph', () => {
    // SSA declares required_by; drivers-license does not declare requires.
    // Both edges should still exist.
    const g = buildDependencyGraph({
      'us-social-security': mockItem({
        slug: 'us-social-security',
        required_by: ['us-drivers-license'],
      }),
      'us-drivers-license': mockItem({ slug: 'us-drivers-license' }),
    })
    expect([...g.requires.get('us-drivers-license')!]).toEqual(['us-social-security'])
    expect([...g.requiredBy.get('us-social-security')!]).toEqual(['us-drivers-license'])
  })

  it('does not double-add when both directions are declared', () => {
    const g = buildDependencyGraph({
      a: mockItem({ slug: 'a', requires: ['b'] }),
      b: mockItem({ slug: 'b', required_by: ['a'] }),
    })
    expect(g.requires.get('a')!.size).toBe(1)
    expect(g.requiredBy.get('b')!.size).toBe(1)
  })

  it('records unknown references without crashing', () => {
    const g = buildDependencyGraph({
      a: mockItem({ slug: 'a', requires: ['ghost'] }),
      b: mockItem({ slug: 'b', required_by: ['phantom'] }),
    })
    expect([...g.unknownReferences].sort()).toEqual(['ghost', 'phantom'])
    // The forward edge is recorded, but no reverse edge to a missing slug.
    expect(g.requires.get('a')!.has('ghost')).toBe(true)
  })

  it('handles branching dependencies', () => {
    const g = buildDependencyGraph({
      a: mockItem({ slug: 'a', requires: ['b', 'c'] }),
      b: mockItem({ slug: 'b' }),
      c: mockItem({ slug: 'c' }),
    })
    expect(g.requires.get('a')!.size).toBe(2)
    expect(g.requiredBy.get('b')!.has('a')).toBe(true)
    expect(g.requiredBy.get('c')!.has('a')).toBe(true)
  })
})

// ── 2. Cycle detection ───────────────────────────────────────────────────────

describe('detectCycles', () => {
  it('finds no cycles in a DAG', () => {
    const g = buildDependencyGraph({
      a: mockItem({ slug: 'a', requires: ['b'] }),
      b: mockItem({ slug: 'b', requires: ['c'] }),
      c: mockItem({ slug: 'c' }),
    })
    expect(detectCycles(g)).toEqual([])
  })

  it('detects a self-loop', () => {
    const g = buildDependencyGraph({
      a: mockItem({ slug: 'a', requires: ['a'] }),
    })
    const cycles = detectCycles(g)
    expect(cycles).toHaveLength(1)
    expect(cycles[0]).toEqual(['a'])
  })

  it('detects a 2-node cycle', () => {
    const g = buildDependencyGraph({
      a: mockItem({ slug: 'a', requires: ['b'] }),
      b: mockItem({ slug: 'b', requires: ['a'] }),
    })
    const cycles = detectCycles(g)
    expect(cycles).toHaveLength(1)
    expect(cycles[0]).toHaveLength(2)
  })

  it('detects a longer cycle', () => {
    const g = buildDependencyGraph({
      a: mockItem({ slug: 'a', requires: ['b'] }),
      b: mockItem({ slug: 'b', requires: ['c'] }),
      c: mockItem({ slug: 'c', requires: ['a'] }),
    })
    const cycles = detectCycles(g)
    expect(cycles).toHaveLength(1)
    expect(cycles[0]).toHaveLength(3)
  })
})

// ── 3. Topological sort ──────────────────────────────────────────────────────

describe('topologicalSort', () => {
  it('produces dependencies-first order for a linear chain', () => {
    const g = buildDependencyGraph({
      a: mockItem({ slug: 'a', requires: ['b'] }),
      b: mockItem({ slug: 'b', requires: ['c'] }),
      c: mockItem({ slug: 'c' }),
    })
    expect(topologicalSort(g)).toEqual(['c', 'b', 'a'])
  })

  it('produces dependencies-first order for a diamond', () => {
    const g = buildDependencyGraph({
      a: mockItem({ slug: 'a', requires: ['b', 'c'] }),
      b: mockItem({ slug: 'b', requires: ['d'] }),
      c: mockItem({ slug: 'c', requires: ['d'] }),
      d: mockItem({ slug: 'd' }),
    })
    const sorted = topologicalSort(g)
    expect(sorted.indexOf('d')).toBeLessThan(sorted.indexOf('b'))
    expect(sorted.indexOf('d')).toBeLessThan(sorted.indexOf('c'))
    expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('a'))
    expect(sorted.indexOf('c')).toBeLessThan(sorted.indexOf('a'))
  })

  it('still returns every slug when cycles exist', () => {
    const g = buildDependencyGraph({
      a: mockItem({ slug: 'a', requires: ['b'] }),
      b: mockItem({ slug: 'b', requires: ['a'] }),
      c: mockItem({ slug: 'c' }),
    })
    const sorted = topologicalSort(g)
    expect(sorted).toHaveLength(3)
    expect(new Set(sorted)).toEqual(new Set(['a', 'b', 'c']))
    // c has no dependencies, comes first; cycle members append at the end.
    expect(sorted[0]).toBe('c')
  })

  it('is deterministic across equivalent runs', () => {
    const items = {
      a: mockItem({ slug: 'a' }),
      b: mockItem({ slug: 'b' }),
      c: mockItem({ slug: 'c' }),
    }
    const g1 = buildDependencyGraph(items)
    const g2 = buildDependencyGraph(items)
    expect(topologicalSort(g1)).toEqual(topologicalSort(g2))
  })
})

// ── 4. Transitive helpers ────────────────────────────────────────────────────

describe('transitiveDependents / transitiveRequirements', () => {
  const g = buildDependencyGraph({
    'court-order': mockItem({ slug: 'court-order' }),
    'us-social-security': mockItem({
      slug: 'us-social-security',
      requires: ['court-order'],
    }),
    'us-drivers-license': mockItem({
      slug: 'us-drivers-license',
      requires: ['us-social-security'],
    }),
    'us-passport': mockItem({
      slug: 'us-passport',
      requires: ['us-social-security'],
    }),
    'bank': mockItem({ slug: 'bank', requires: ['us-drivers-license'] }),
  })

  it('finds all transitive dependents', () => {
    const downstream = transitiveDependents(g, 'court-order')
    expect(downstream).toEqual(
      new Set(['us-social-security', 'us-drivers-license', 'us-passport', 'bank'])
    )
  })

  it('finds all transitive requirements', () => {
    const upstream = transitiveRequirements(g, 'bank')
    expect(upstream).toEqual(
      new Set(['us-drivers-license', 'us-social-security', 'court-order'])
    )
  })

  it('returns empty for leaf and root nodes appropriately', () => {
    expect(transitiveDependents(g, 'bank').size).toBe(0)
    expect(transitiveRequirements(g, 'court-order').size).toBe(0)
  })
})

// ── 5. Status semantics ──────────────────────────────────────────────────────

describe('isSatisfying / SATISFYING_STATUSES', () => {
  it('treats complete and at_risk as satisfying', () => {
    expect(isSatisfying('complete')).toBe(true)
    expect(isSatisfying('at_risk')).toBe(true)
    expect(SATISFYING_STATUSES.has('complete')).toBe(true)
    expect(SATISFYING_STATUSES.has('at_risk')).toBe(true)
  })

  it('does not treat revoked as satisfying', () => {
    expect(isSatisfying('revoked')).toBe(false)
  })

  it('does not treat in-progress / pending statuses as satisfying', () => {
    const nonSatisfying: ItemStatus[] = [
      'not_started',
      'in_progress',
      'skipped',
      'not_applicable',
      'cant_right_now',
    ]
    for (const s of nonSatisfying) {
      expect(isSatisfying(s)).toBe(false)
    }
    expect(isSatisfying(undefined)).toBe(false)
  })
})

describe('getSatisfiedSlugs', () => {
  it('includes onboarding-declared documents_obtained', () => {
    const ud = mockUserData({ documents_obtained: ['court-order'] })
    expect(getSatisfiedSlugs(ud).has('court-order')).toBe(true)
  })

  it('includes checklist entries with satisfying status', () => {
    const ud = mockUserData({
      checklist: {
        'us-social-security': { status: 'complete' },
        'us-drivers-license': { status: 'at_risk' },
      },
    })
    const set = getSatisfiedSlugs(ud)
    expect(set.has('us-social-security')).toBe(true)
    expect(set.has('us-drivers-license')).toBe(true)
  })

  it('excludes revoked entries and other non-satisfying statuses', () => {
    const ud = mockUserData({
      checklist: {
        a: { status: 'revoked' },
        b: { status: 'in_progress' },
        c: { status: 'skipped' },
        d: { status: 'cant_right_now' },
      },
    })
    const set = getSatisfiedSlugs(ud)
    expect(set.has('a')).toBe(false)
    expect(set.has('b')).toBe(false)
    expect(set.has('c')).toBe(false)
    expect(set.has('d')).toBe(false)
  })

  it('includes complete custom items', () => {
    const ud = mockUserData()
    ud.custom_items.push({
      id: 'custom-court-equivalent',
      label: 'Foreign legal name change document',
      category: 'government-id',
      track: 'legal',
      status: 'complete',
      notes: '',
    })
    expect(getSatisfiedSlugs(ud).has('custom-court-equivalent')).toBe(true)
  })
})

// ── 6. Stored-blocker semantics ──────────────────────────────────────────────

describe('isActiveStoredBlocker', () => {
  it('treats non-document blockers as active', () => {
    for (const type of [
      'relationship',
      'safety',
      'readiness',
      'waiting',
      'financial',
      'custom',
    ] as Blocker['type'][]) {
      expect(isActiveStoredBlocker(blocker({ id: 't', type }))).toBe(true)
    }
  })

  it('ignores stored document blockers', () => {
    // CLAUDE.md: document blockers must never be stored. If one exists
    // (e.g. legacy import), the graph is the source of truth and we ignore it.
    expect(
      isActiveStoredBlocker(
        blocker({ id: 'legacy', type: 'document', user_defined: false })
      )
    ).toBe(false)
  })
})

// ── 7. Per-item availability ─────────────────────────────────────────────────

describe('computeItemAvailability', () => {
  it('marks an item with no requires and no blockers as available', () => {
    const kb = mockKB([mockItem({ slug: 'a' })])
    const ud = mockUserData()
    const av = computeItemAvailability('a', kb, ud)
    expect(av.available).toBe(true)
    expect(av.documentBlocked).toBe(false)
    expect(av.hasUserBlockers).toBe(false)
    expect(av.unmetRequirements).toEqual([])
  })

  it('marks an item with unmet requires as document-blocked', () => {
    const kb = mockKB([
      mockItem({ slug: 'a', requires: ['b'] }),
      mockItem({ slug: 'b' }),
    ])
    const ud = mockUserData()
    const av = computeItemAvailability('a', kb, ud)
    expect(av.documentBlocked).toBe(true)
    expect(av.unmetRequirements).toEqual(['b'])
    expect(av.available).toBe(false)
  })

  it('marks an item as available once its requires are satisfied', () => {
    const kb = mockKB([
      mockItem({ slug: 'a', requires: ['b'] }),
      mockItem({ slug: 'b', label: 'B-document' }),
    ])
    const ud = mockUserData({ checklist: { b: { status: 'complete' } } })
    const av = computeItemAvailability('a', kb, ud)
    expect(av.documentBlocked).toBe(false)
    expect(av.available).toBe(true)
  })

  it('treats a stored user-defined blocker as blocking', () => {
    const kb = mockKB([mockItem({ slug: 'a' })])
    const ud = mockUserData({
      checklist: {
        a: {
          blockers: [
            blocker({ id: 'r1', type: 'relationship', label: 'Not sure she is safe' }),
          ],
        },
      },
    })
    const av = computeItemAvailability('a', kb, ud)
    expect(av.hasUserBlockers).toBe(true)
    expect(av.available).toBe(false)
    expect(av.primaryBlockerLabel).toBe('Not sure she is safe')
  })

  it('ignores stored document blockers (graph is the source of truth)', () => {
    const kb = mockKB([mockItem({ slug: 'a' })])
    const ud = mockUserData({
      checklist: {
        a: {
          blockers: [blocker({ id: 'd1', type: 'document', user_defined: false })],
        },
      },
    })
    const av = computeItemAvailability('a', kb, ud)
    expect(av.hasUserBlockers).toBe(false)
    expect(av.available).toBe(true)
  })

  it('marks an already-completed item as not available', () => {
    const kb = mockKB([mockItem({ slug: 'a' })])
    const ud = mockUserData({ checklist: { a: { status: 'complete' } } })
    const av = computeItemAvailability('a', kb, ud)
    expect(av.isSatisfying).toBe(true)
    expect(av.available).toBe(false)
  })

  it('falls back to KB label for primary blocker when no stored blocker', () => {
    const kb = mockKB([
      mockItem({ slug: 'a', requires: ['b'] }),
      mockItem({ slug: 'b', label: 'Court Order' }),
    ])
    const ud = mockUserData()
    const av = computeItemAvailability('a', kb, ud)
    expect(av.primaryBlockerLabel).toBe('Court Order')
  })

  it('handles a revoked dependency by marking the dependent unavailable again', () => {
    const kb = mockKB([
      mockItem({ slug: 'a', requires: ['b'] }),
      mockItem({ slug: 'b' }),
    ])
    const ud = mockUserData({ checklist: { b: { status: 'revoked' } } })
    const av = computeItemAvailability('a', kb, ud)
    expect(av.documentBlocked).toBe(true)
    expect(av.available).toBe(false)
  })

  it('treats at_risk dependencies as still satisfying', () => {
    const kb = mockKB([
      mockItem({ slug: 'a', requires: ['b'] }),
      mockItem({ slug: 'b' }),
    ])
    const ud = mockUserData({ checklist: { b: { status: 'at_risk' } } })
    const av = computeItemAvailability('a', kb, ud)
    expect(av.documentBlocked).toBe(false)
    expect(av.available).toBe(true)
  })
})

// ── 8. The headline rule: completion does not cascade ────────────────────────

describe('completion does not cascade', () => {
  it('marking a required item complete makes dependents AVAILABLE, not complete', () => {
    // The cardinal rule from CLAUDE.md: "Having the key does not open the door."
    const kb = mockKB([
      mockItem({ slug: 'us-social-security' }),
      mockItem({
        slug: 'us-drivers-license',
        requires: ['us-social-security'],
      }),
    ])

    // Before: SSA not started, license is document-blocked.
    const before = mockUserData()
    const beforeLicense = computeItemAvailability('us-drivers-license', kb, before)
    expect(beforeLicense.available).toBe(false)
    expect(beforeLicense.documentBlocked).toBe(true)

    // After: SSA marked complete. License becomes available — but its
    // own status is unchanged, still `not_started`.
    const after = mockUserData({
      checklist: { 'us-social-security': { status: 'complete' } },
    })
    const afterLicense = computeItemAvailability('us-drivers-license', kb, after)
    expect(afterLicense.available).toBe(true)
    expect(afterLicense.documentBlocked).toBe(false)
    expect(afterLicense.status).toBe('not_started')
    expect(afterLicense.isSatisfying).toBe(false)
  })
})

// ── 9. computeAllAvailability ────────────────────────────────────────────────

describe('computeAllAvailability', () => {
  it('returns one entry per KB item', () => {
    const kb = mockKB([
      mockItem({ slug: 'a' }),
      mockItem({ slug: 'b' }),
      mockItem({ slug: 'c' }),
    ])
    const map = computeAllAvailability(kb, mockUserData())
    expect(map.size).toBe(3)
    expect([...map.keys()].sort()).toEqual(['a', 'b', 'c'])
  })
})

// ── 10. Filters ──────────────────────────────────────────────────────────────

describe('filters', () => {
  const kb = mockKB([
    mockItem({ slug: 'a', track: 'legal' }),
    mockItem({ slug: 'b', track: 'legal', requires: ['a'] }),
    mockItem({ slug: 'c', track: 'medical' }),
    mockItem({ slug: 'd', track: 'legal' }),
  ])

  it('filterAvailableNow returns only available items, optionally by track', () => {
    const ud = mockUserData()
    const av = computeAllAvailability(kb, ud)
    const all = filterAvailableNow(av, kb).map((a) => a.slug).sort()
    // a, c, d are available (no requires, no blockers). b is blocked by a.
    expect(all).toEqual(['a', 'c', 'd'])

    const legalOnly = filterAvailableNow(av, kb, { tracks: ['legal'] })
      .map((a) => a.slug)
      .sort()
    expect(legalOnly).toEqual(['a', 'd'])
  })

  it('filterBlocked returns blocked-but-not-completed items', () => {
    const ud = mockUserData()
    const av = computeAllAvailability(kb, ud)
    const blocked = filterBlocked(av, kb).map((a) => a.slug)
    expect(blocked).toEqual(['b'])
  })

  it('filterCompleted returns satisfying items', () => {
    const ud = mockUserData({
      checklist: { a: { status: 'complete' }, c: { status: 'at_risk' } },
    })
    const av = computeAllAvailability(kb, ud)
    const done = filterCompleted(av, kb).map((a) => a.slug).sort()
    expect(done).toEqual(['a', 'c'])
  })
})

// ── 11. itemsUnlockedBy ──────────────────────────────────────────────────────

describe('itemsUnlockedBy', () => {
  it('returns items where the slug was the last missing dep', () => {
    const kb = mockKB([
      mockItem({ slug: 'court-order' }),
      mockItem({ slug: 'us-social-security', requires: ['court-order'] }),
      mockItem({ slug: 'us-drivers-license', requires: ['us-social-security'] }),
      mockItem({ slug: 'us-passport', requires: ['us-social-security'] }),
    ])
    const ud = mockUserData({ checklist: { 'court-order': { status: 'complete' } } })
    expect(itemsUnlockedBy('us-social-security', kb, ud)).toEqual([
      'us-drivers-license',
      'us-passport',
    ])
  })

  it('does not return items still blocked by other unmet deps', () => {
    const kb = mockKB([
      mockItem({ slug: 'a' }),
      mockItem({ slug: 'b' }),
      mockItem({ slug: 'c', requires: ['a', 'b'] }),
    ])
    const ud = mockUserData() // neither a nor b complete
    // Marking a complete would still leave c blocked by b.
    expect(itemsUnlockedBy('a', kb, ud)).toEqual([])
  })

  it('does not return items already in a satisfying status', () => {
    const kb = mockKB([
      mockItem({ slug: 'a' }),
      mockItem({ slug: 'b', requires: ['a'] }),
    ])
    const ud = mockUserData({ checklist: { b: { status: 'complete' } } })
    expect(itemsUnlockedBy('a', kb, ud)).toEqual([])
  })

  it('does not return items with active stored blockers', () => {
    const kb = mockKB([
      mockItem({ slug: 'a' }),
      mockItem({ slug: 'b', requires: ['a'] }),
    ])
    const ud = mockUserData({
      checklist: {
        b: { blockers: [blocker({ id: 'r1', type: 'safety' })] },
      },
    })
    expect(itemsUnlockedBy('a', kb, ud)).toEqual([])
  })
})

// ── 12. recommendStartHere ───────────────────────────────────────────────────

describe('recommendStartHere', () => {
  it('returns nothing if no items are available', () => {
    const kb = mockKB([
      mockItem({ slug: 'a', requires: ['ghost'] }), // ghost not in KB; never satisfied
    ])
    const recs = recommendStartHere(kb, mockUserData())
    expect(recs).toEqual([])
  })

  it('prefers items that unlock more downstream items', () => {
    const kb = mockKB([
      mockItem({ slug: 'foundation', importance: 'medium' as ItemImportance }),
      mockItem({
        slug: 'lonely',
        importance: 'medium' as ItemImportance,
      }),
      mockItem({ slug: 'd1', requires: ['foundation'] }),
      mockItem({ slug: 'd2', requires: ['foundation'] }),
      mockItem({ slug: 'd3', requires: ['foundation'] }),
    ])
    const recs = recommendStartHere(kb, mockUserData(), { max: 1 })
    expect(recs).toHaveLength(1)
    expect(recs[0].slug).toBe('foundation')
  })

  it('respects importance weighting', () => {
    const kb = mockKB([
      mockItem({ slug: 'critical-thing', importance: 'critical' as ItemImportance }),
      mockItem({ slug: 'low-thing', importance: 'low' as ItemImportance }),
    ])
    const recs = recommendStartHere(kb, mockUserData(), { max: 2 })
    expect(recs[0].slug).toBe('critical-thing')
  })

  it('respects active-track filter', () => {
    const kb = mockKB([
      mockItem({ slug: 'legal-a', track: 'legal' }),
      mockItem({ slug: 'medical-a', track: 'medical' }),
    ])
    const recs = recommendStartHere(kb, mockUserData({ active_tracks: ['legal'] }))
    expect(recs.every((r) => r.slug.startsWith('legal'))).toBe(true)
  })

  it('does not recommend already-satisfying items', () => {
    const kb = mockKB([
      mockItem({ slug: 'done', importance: 'critical' as ItemImportance }),
      mockItem({ slug: 'todo', importance: 'low' as ItemImportance }),
    ])
    const ud = mockUserData({ checklist: { done: { status: 'complete' } } })
    const recs = recommendStartHere(kb, ud)
    expect(recs.map((r) => r.slug)).toEqual(['todo'])
  })

  it('does not recommend blocked items', () => {
    const kb = mockKB([
      mockItem({ slug: 'foundation', importance: 'medium' as ItemImportance }),
      mockItem({
        slug: 'blocked',
        importance: 'critical' as ItemImportance,
        requires: ['foundation'],
      }),
    ])
    const recs = recommendStartHere(kb, mockUserData(), { max: 1 })
    expect(recs[0].slug).toBe('foundation')
  })

  it('caps results at the requested max (default 2)', () => {
    const kb = mockKB([
      mockItem({ slug: 'a' }),
      mockItem({ slug: 'b' }),
      mockItem({ slug: 'c' }),
      mockItem({ slug: 'd' }),
    ])
    expect(recommendStartHere(kb, mockUserData())).toHaveLength(2)
    expect(recommendStartHere(kb, mockUserData(), { max: 1 })).toHaveLength(1)
    expect(recommendStartHere(kb, mockUserData(), { max: 4 })).toHaveLength(4)
  })

  it('produces a deterministic order on ties', () => {
    const kb = mockKB([
      mockItem({ slug: 'b-thing' }),
      mockItem({ slug: 'a-thing' }),
    ])
    const r1 = recommendStartHere(kb, mockUserData())
    const r2 = recommendStartHere(kb, mockUserData())
    expect(r1.map((r) => r.slug)).toEqual(r2.map((r) => r.slug))
    // Lexicographic tie-break.
    expect(r1[0].slug).toBe('a-thing')
  })
})
