// Dependency graph and ordering logic for the Transition Companion checklist.
//
// Architectural rules (see design doc, "Order of Operations Logic", and CLAUDE.md):
//
//   1. Document blockers are DERIVED from the graph + user state. They are
//      never stored as records on a checklist entry. Marking a required item
//      complete therefore "auto-resolves" document dependencies on next read.
//
//   2. User-defined blockers (relationship, safety, readiness, waiting,
//      legal, access, custom) ARE stored on the checklist entry. The graph
//      treats them as opaque — only the user can mark them resolved.
//
//   3. Completion never cascades. Marking a required item complete makes its
//      dependents AVAILABLE, not AUTOMATICALLY complete. This module only
//      computes availability — it never changes any user-set status.
//
//   4. Pure functions. Same KB + same UserData -> same answers. No I/O,
//      no globals, no time-dependent behavior.

import type {
  Blocker,
  ChecklistEntry,
  ItemImportance,
  ItemStatus,
  KBCache,
  KBItem,
  UserData,
} from '../types'

// ── 1. Graph construction ─────────────────────────────────────────────────────

export interface DependencyGraph {
  /** slug -> set of slugs it requires (forward edges). */
  requires: Map<string, Set<string>>
  /** slug -> set of slugs that require it (reverse edges). */
  requiredBy: Map<string, Set<string>>
  /** All slugs known to the graph (i.e. present in the KB). */
  slugs: Set<string>
  /** Slugs referenced by `requires` / `required_by` but not present in the KB. */
  unknownReferences: Set<string>
}

/**
 * Build the directed dependency graph from KB items. Forward (`requires`)
 * and reverse (`required_by`) declarations are merged: declaring an edge in
 * either direction creates both edges in the graph.
 */
export function buildDependencyGraph(
  items: Record<string, KBItem>
): DependencyGraph {
  const requires = new Map<string, Set<string>>()
  const requiredBy = new Map<string, Set<string>>()
  const slugs = new Set<string>(Object.keys(items))
  const unknown = new Set<string>()

  for (const slug of slugs) {
    requires.set(slug, new Set())
    requiredBy.set(slug, new Set())
  }

  for (const slug of slugs) {
    const item = items[slug]

    for (const dep of item.requires ?? []) {
      requires.get(slug)!.add(dep)
      if (slugs.has(dep)) {
        requiredBy.get(dep)!.add(slug)
      } else {
        unknown.add(dep)
      }
    }

    for (const dependent of item.required_by ?? []) {
      if (!slugs.has(dependent)) {
        unknown.add(dependent)
        continue
      }
      requiredBy.get(slug)!.add(dependent)
      requires.get(dependent)!.add(slug)
    }
  }

  return { requires, requiredBy, slugs, unknownReferences: unknown }
}

// ── 2. Cycle detection ────────────────────────────────────────────────────────

/**
 * Find all cycles in the requires graph. Each cycle is returned as an
 * ordered list of slugs (the implicit closing edge from the last back to
 * the first is not repeated).
 *
 * Cycles in the KB are a data error. The rest of the module tolerates them
 * — items in a cycle will simply have unmet requirements forever — but
 * surfacing them is useful for diagnostics and tests.
 */
export function detectCycles(graph: DependencyGraph): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const onPath = new Set<string>()
  const path: string[] = []

  function dfs(slug: string): void {
    if (onPath.has(slug)) {
      const start = path.indexOf(slug)
      cycles.push(path.slice(start))
      return
    }
    if (visited.has(slug)) return

    visited.add(slug)
    onPath.add(slug)
    path.push(slug)

    const deps = graph.requires.get(slug)
    if (deps) {
      // Sort for deterministic cycle ordering across runs.
      for (const dep of [...deps].sort()) {
        if (graph.slugs.has(dep)) dfs(dep)
      }
    }

    onPath.delete(slug)
    path.pop()
  }

  for (const slug of [...graph.slugs].sort()) {
    if (!visited.has(slug)) dfs(slug)
  }

  return cycles
}

// ── 3. Topological sort ───────────────────────────────────────────────────────

/**
 * Kahn-style topological sort: dependencies first, dependents after.
 *
 * Tolerates cycles by appending any unsorted slugs at the end in
 * lexicographic order. Always returns every slug exactly once.
 */
export function topologicalSort(graph: DependencyGraph): string[] {
  const inDegree = new Map<string, number>()
  for (const slug of graph.slugs) {
    let deg = 0
    for (const dep of graph.requires.get(slug) ?? []) {
      if (graph.slugs.has(dep)) deg++
    }
    inDegree.set(slug, deg)
  }

  const result: string[] = []
  const queue: string[] = [...inDegree.entries()]
    .filter(([, d]) => d === 0)
    .map(([s]) => s)
    .sort()

  while (queue.length > 0) {
    const slug = queue.shift()!
    result.push(slug)

    const dependents = [...(graph.requiredBy.get(slug) ?? [])].sort()
    for (const dep of dependents) {
      const next = (inDegree.get(dep) ?? 0) - 1
      inDegree.set(dep, next)
      if (next === 0) {
        let i = 0
        while (i < queue.length && queue[i] < dep) i++
        queue.splice(i, 0, dep)
      }
    }
  }

  if (result.length < graph.slugs.size) {
    const placed = new Set(result)
    const remaining = [...graph.slugs].filter((s) => !placed.has(s)).sort()
    result.push(...remaining)
  }

  return result
}

// ── 4. Transitive helpers ─────────────────────────────────────────────────────

/** All slugs that transitively require `slug`. Excludes `slug` itself. */
export function transitiveDependents(
  graph: DependencyGraph,
  slug: string
): Set<string> {
  const result = new Set<string>()
  const stack = [...(graph.requiredBy.get(slug) ?? [])]
  while (stack.length > 0) {
    const next = stack.pop()!
    if (result.has(next)) continue
    result.add(next)
    for (const further of graph.requiredBy.get(next) ?? []) {
      if (!result.has(further)) stack.push(further)
    }
  }
  return result
}

/** All slugs that `slug` transitively requires. Excludes `slug` itself. */
export function transitiveRequirements(
  graph: DependencyGraph,
  slug: string
): Set<string> {
  const result = new Set<string>()
  const stack = [...(graph.requires.get(slug) ?? [])]
  while (stack.length > 0) {
    const next = stack.pop()!
    if (result.has(next)) continue
    result.add(next)
    for (const further of graph.requires.get(next) ?? []) {
      if (!result.has(further)) stack.push(further)
    }
  }
  return result
}

// ── 5. Status semantics ───────────────────────────────────────────────────────

/**
 * Statuses where the user actually possesses the document / has done the
 * thing — and therefore satisfies any document dependency declared by
 * another item.
 *
 *   complete  — done; document obtained.
 *   at_risk   — was complete; document still in the user's hands but
 *               threatened by external policy. Dependents stay unblocked.
 *
 * `revoked` is intentionally excluded: a revocation means the document was
 * actively reversed by an external party, so dependents are no longer
 * satisfied. (`skipped`, `not_applicable`, `cant_right_now`, `in_progress`,
 * and `not_started` are not possessions of the document either.)
 */
export const SATISFYING_STATUSES: ReadonlySet<ItemStatus> = new Set<ItemStatus>([
  'complete',
  'at_risk',
])

export function isSatisfying(status: ItemStatus | undefined): boolean {
  return status !== undefined && SATISFYING_STATUSES.has(status)
}

/**
 * The set of slugs the user effectively possesses:
 *
 *   - any checklist entry whose status satisfies a document dependency
 *   - anything in `profile.documents_obtained` (declared at onboarding)
 *   - any custom item with status `complete` (lets users declare equivalents)
 */
export function getSatisfiedSlugs(userData: UserData): Set<string> {
  const set = new Set<string>(userData.profile.documents_obtained ?? [])

  for (const [slug, entry] of Object.entries(userData.checklist)) {
    if (isSatisfying(entry.status)) set.add(slug)
  }

  for (const custom of userData.custom_items ?? []) {
    if (custom.status === 'complete') set.add(custom.id)
  }

  return set
}

// ── 6. Per-item availability ──────────────────────────────────────────────────

const IMPLICIT_STATUS: ItemStatus = 'not_started'

/**
 * A stored blocker counts as actively blocking iff its `type` is anything
 * other than `document`. Document blockers must not be stored — see CLAUDE.md.
 * If a stored document blocker exists (e.g. legacy import), we ignore it:
 * the graph is the source of truth for document satisfaction.
 */
export function isActiveStoredBlocker(blocker: Blocker): boolean {
  return blocker.type !== 'document'
}

export interface ItemAvailability {
  slug: string
  status: ItemStatus
  /** True iff `status` is in `SATISFYING_STATUSES`. */
  isSatisfying: boolean

  /** Required slugs not yet satisfied by the user's progress. */
  unmetRequirements: string[]
  /** True iff `unmetRequirements.length > 0`. */
  documentBlocked: boolean

  /** Stored blockers that are actively blocking (i.e. non-document type). */
  storedBlockers: Blocker[]
  hasUserBlockers: boolean

  /**
   * The item is ready to be acted on right now: not already in a satisfying
   * status, no unmet document dependencies, no active stored blockers.
   */
  available: boolean

  /**
   * A short label for "waiting on X" UI. Prefers the first stored blocker's
   * label (the user wrote it, so it's already in their voice). Falls back
   * to the KB label of the first unmet requirement, or its slug if the
   * referenced item is not in the KB.
   */
  primaryBlockerLabel: string | null
}

export function computeItemAvailability(
  slug: string,
  kb: KBCache,
  userData: UserData
): ItemAvailability {
  const item = kb.items[slug]
  const entry: ChecklistEntry | undefined = userData.checklist[slug]
  const status = entry?.status ?? IMPLICIT_STATUS
  const satisfying = isSatisfying(status)

  const satisfied = getSatisfiedSlugs(userData)
  const requires = item?.requires ?? []
  const unmet: string[] = []
  for (const req of requires) {
    if (!satisfied.has(req)) unmet.push(req)
  }

  const stored = entry?.blockers ?? []
  const activeStored = stored.filter(isActiveStoredBlocker)
  const docBlocked = unmet.length > 0
  const userBlocked = activeStored.length > 0

  const available = !satisfying && !docBlocked && !userBlocked

  let primaryBlockerLabel: string | null = null
  if (activeStored.length > 0) {
    primaryBlockerLabel = activeStored[0].label
  } else if (unmet.length > 0) {
    const firstUnmet = unmet[0]
    primaryBlockerLabel = kb.items[firstUnmet]?.label ?? firstUnmet
  }

  return {
    slug,
    status,
    isSatisfying: satisfying,
    unmetRequirements: unmet,
    documentBlocked: docBlocked,
    storedBlockers: activeStored,
    hasUserBlockers: userBlocked,
    available,
    primaryBlockerLabel,
  }
}

export function computeAllAvailability(
  kb: KBCache,
  userData: UserData
): Map<string, ItemAvailability> {
  const map = new Map<string, ItemAvailability>()
  for (const slug of Object.keys(kb.items)) {
    map.set(slug, computeItemAvailability(slug, kb, userData))
  }
  return map
}

// ── 7. Dashboard-oriented filters ─────────────────────────────────────────────

export interface FilterOptions {
  /** Restrict to items in these tracks. Empty/undefined = no filter. */
  tracks?: string[]
  /** Restrict to items in these categories. Empty/undefined = no filter. */
  categories?: string[]
}

function matchesFilter(item: KBItem | undefined, opts?: FilterOptions): boolean {
  if (!item) return true
  if (opts?.tracks && opts.tracks.length > 0 && !opts.tracks.includes(item.track)) return false
  if (opts?.categories && opts.categories.length > 0 && !opts.categories.includes(item.category)) return false
  return true
}

export function filterAvailableNow(
  availability: Map<string, ItemAvailability>,
  kb: KBCache,
  opts?: FilterOptions
): ItemAvailability[] {
  return [...availability.values()].filter(
    (a) => a.available && matchesFilter(kb.items[a.slug], opts)
  )
}

export function filterBlocked(
  availability: Map<string, ItemAvailability>,
  kb: KBCache,
  opts?: FilterOptions
): ItemAvailability[] {
  return [...availability.values()].filter(
    (a) => !a.isSatisfying && !a.available && matchesFilter(kb.items[a.slug], opts)
  )
}

export function filterCompleted(
  availability: Map<string, ItemAvailability>,
  kb: KBCache,
  opts?: FilterOptions
): ItemAvailability[] {
  return [...availability.values()].filter(
    (a) => a.isSatisfying && matchesFilter(kb.items[a.slug], opts)
  )
}

// ── 8. "Start here" recommendations ───────────────────────────────────────────

const IMPORTANCE_WEIGHT: Record<ItemImportance, number> = {
  critical: 1000,
  high: 500,
  medium: 100,
  low: 25,
}

const REASON_RANK = {
  critical_foundation: 4,
  unlocks_many: 3,
  high_importance: 2,
  aligned_with_goal: 1,
} as const

export type RecommendationReason = keyof typeof REASON_RANK

export interface StartHereRecommendation {
  slug: string
  score: number
  reason: RecommendationReason
}

/**
 * Recommend one or two items the user could start with. The design intent
 * is "one or two, not a long ranked list" — so callers should display the
 * top one or two and not a pseudo-prioritized backlog.
 *
 * Scoring per available item (in active tracks):
 *
 *     importance_weight
 *   + 50 * (count of items that transitively require this one)
 *   + 200 if the item's track matches the user's first active track
 *
 * Returns at most `max` items (default 2). Empty if nothing qualifies.
 */
export function recommendStartHere(
  kb: KBCache,
  userData: UserData,
  options?: { max?: number; tracks?: string[] }
): StartHereRecommendation[] {
  const max = options?.max ?? 2
  const graph = buildDependencyGraph(kb.items)
  const availability = computeAllAvailability(kb, userData)

  const activeTracks = options?.tracks ?? userData.profile.active_tracks ?? []
  const trackFilter = activeTracks.length > 0 ? activeTracks : undefined
  const firstTrack = activeTracks[0]

  const candidates: ItemAvailability[] = []
  for (const a of availability.values()) {
    if (!a.available) continue
    const item = kb.items[a.slug]
    if (!item) continue
    if (trackFilter && !trackFilter.includes(item.track)) continue
    candidates.push(a)
  }

  if (candidates.length === 0) return []

  const scored = candidates.map((a) => {
    const item = kb.items[a.slug]!
    const downstream = transitiveDependents(graph, a.slug).size
    const importance = IMPORTANCE_WEIGHT[item.importance] ?? 0
    const trackBonus = firstTrack && item.track === firstTrack ? 200 : 0

    const score = importance + downstream * 50 + trackBonus

    let reason: RecommendationReason
    if (item.importance === 'critical' && downstream >= 2) reason = 'critical_foundation'
    else if (downstream >= 3) reason = 'unlocks_many'
    else if (item.importance === 'critical' || item.importance === 'high') reason = 'high_importance'
    else reason = 'aligned_with_goal'

    return { slug: a.slug, score, reason }
  })

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (REASON_RANK[b.reason] !== REASON_RANK[a.reason]) {
      return REASON_RANK[b.reason] - REASON_RANK[a.reason]
    }
    return a.slug.localeCompare(b.slug)
  })

  return scored.slice(0, max)
}

// ── 9. Items unlocked by completing a slug ────────────────────────────────────

/**
 * If the user marked `slug` as complete right now, which currently-blocked
 * items would become available? Respects the user's other unmet
 * requirements and active stored blockers — this only reports items where
 * `slug` was the last missing dependency and nothing else is in the way.
 *
 * Useful for "completing this will unlock: X, Y" hints at `some_guidance`
 * and `walk_with_me` presence levels.
 */
export function itemsUnlockedBy(
  slug: string,
  kb: KBCache,
  userData: UserData
): string[] {
  const graph = buildDependencyGraph(kb.items)
  const dependents = graph.requiredBy.get(slug)
  if (!dependents || dependents.size === 0) return []

  const simulatedSatisfied = getSatisfiedSlugs(userData)
  simulatedSatisfied.add(slug)

  const result: string[] = []
  for (const dep of dependents) {
    const item = kb.items[dep]
    if (!item) continue

    const entry = userData.checklist[dep]
    if (isSatisfying(entry?.status)) continue

    const stillUnmet = (item.requires ?? []).some((r) => !simulatedSatisfied.has(r))
    if (stillUnmet) continue

    const activeStored = (entry?.blockers ?? []).filter(isActiveStoredBlocker)
    if (activeStored.length > 0) continue

    result.push(dep)
  }

  return result.sort()
}
