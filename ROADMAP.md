# Transition Companion — Roadmap

---

## Current phase

See CLAUDE.md.

---

## Phase map

### Phase 19 — Second Dogfood Review · Opus · high
**Status: NOT STARTED. Held on dogfood window — 18B/C/D must have been
used in personal daily-use for 2–3 weeks before this phase opens.**

Review and planning only, no code. Categorize dogfood notes (already a
running personal doc outside the repo); update the post-dogfood roadmap;
decide where pronouns/names model expansion lands; raise any
accessibility *design* questions surfaced by personal use (interaction
modes, quick-exit, density for harder-day-readability).

### Phase 20 — Post-Dogfood Roadmap · Opus · high
**Status: gated on Phase 19.**

Planning. Output: sequenced roadmap from current state to public beta,
with explicit slots for the accessibility phase and the privacy phase
(both pre-community-release per `spec/technical.md`). Decides beta access
model and locks in privacy values and red lines.

### Phase A — Accessibility · Sonnet · medium-to-high
**Status: gated on Phase 20 scoping. Phase number assigned in Phase 20.**

Tooling baseline (jsx-a11y ESLint plugin, lighthouse, contrast checks),
audit pass, lint fixes. Design questions raised by Phase 19/20 get
scoped inside this phase or split out.

### Phase P — Privacy values + red lines · Opus · high
**Status: gated on Phase 20 scoping. Phase number assigned in Phase 20.**

Lock in what the app promises about user data and what it explicitly
refuses to do. Audit the existing data flow against the locked values.
Phase 20 decides whether this is one phase or split.

### Phase 21 — Open Public Beta · Sonnet · varies
Beta launch. Fix-and-polish sprints during. No new features unless they
directly unblock beta users.

### Phase 22 — Beta Feedback to v1.0 Roadmap · Opus · high
Planning. Defines v1.0 scope.

### Phase 23 — v2 and beyond · TBD
Not planned in detail. Candidates listed in Backlog.

### Items pending phase assignment (before Phase 21)
- **Pronouns/names model expansion (D2 in pre-migration history)** —
  multi-name and multi-pronoun support with context labels;
  plural-system-not-hostile copy review. Phase 19 should pin a phase
  number.
- **localStorage quota strategy** — pre-community-release blocker per
  `spec/technical.md`.
- **Python in build chain — cross-platform stability** —
  pre-community-release blocker per `spec/technical.md`.

---

## Backlog

Things that have come up but aren't scheduled. Promote to phase map when
prioritized.

- ICS calendar export for recurring items.
- Multi-time-per-day recurring patterns (morning/evening doses).
- Calendar-based recurrence (first-Sunday-of-month, etc.).
- Per-reminder surfacing window (day-of / day-before / week-before) (D4).
- Onboarding priority/ranking capture (D3).
- Dark mode + OS preference detection (D1).
- User-story-driven automated test suite (D6 — ongoing practice rather
  than a feature).
- Expanded KB coverage (more states, more item types).
- Contribution pipeline maturation (structured submissions, community
  verification, cross-state experience provenance).
- Quick-exit / privacy mode (panic-close pattern). Draft design thinking
  deferred with the dogfood notes.
- Bucket 4 in KB dep map: 16 unclassified isolated items still pending
  wiring to `_standalone` or `requires` edges. Editorial, ongoing.

**Separate companion projects (out of scope for this app per `spec/product.md`):**
- Photo / transition-timeline app.
- Health and transition logging (weight, hormones, mood).
- Versatile tracking companion that can push and pull from Transition
  Companion data (v2 candidate).

---

## Open design questions

Questions that must be resolved before building the affected phase. Do
not let implementation decide these by default.

- **Quick-exit / privacy mode pattern.** Draft design thinking exists
  (onboarding-prompt-driven, threat-context-aware). Phase 19 / 20
  decides whether design lands before or as part of Phase A
  (Accessibility) given the overlap with safety-driven interaction
  design.
- **Dark mode + OS preference detection (D1).** Currently in v2. Phase
  20 decides whether it gets promoted as beta-blocking on
  accessibility / eye-strain grounds.
- **Pronouns / names model expansion.** Schema direction exists in
  pre-migration history; not implemented. Phase 19 picks the phase.
- **Health-logging companion integration story.** No hooks defined in
  current architecture. Design when the work approaches, not before.
- **`required_by` field on KB items currently unpopulated.** All
  dependency edges are encoded only in `requires`. UI derives the
  reverse edges. If this changes, ordering graph + bundled snapshot
  must be considered together.

---

## Decisions log

### Foundational

**Dependency graph is a pure computed function. Completion does not cascade.**
[pre-migration — provenance unknown]
Completing a required item makes dependents *available*, not *complete*.
The app never auto-changes one item's status from another item's
completion. "Having the key does not open the door — it means the door
can now be opened." Document blockers are derived from the graph;
user-defined blockers (relationship, safety, readiness, waiting, custom)
are stored records that only the user can resolve.

**KB content philosophy: authoritative reference > broad steps > full summary.**
[pre-migration — provenance unknown]
The app maps terrain and points at sources of truth. It is not a legal
encyclopedia or policy newsletter. Find the authoritative reference,
link to it, list skeletal orienting steps, defer specifics. Keeps the DB
small, keeps content fresh, makes contribution easy. Existing KB does
not yet uniformly follow this — incremental cleanup as content phases
touch items.

**Privacy posture: no first-person plural; the app is a tool, not a service.**
[pre-migration — provenance unknown]
No "we" or "us" in copy. Data is recorded locally for the user's own
reference. Onboarding collects data the user is recording for
themselves, not submitting. Contribution is explicit, optional,
one-directional, anonymized at the process level. Personal notes never
included in contributions.

### Phase 12–17 wave decisions

The numbered decisions D-1 through D-9 from the Phase 13 review (settled
across Phases 12–17) are catalogued in
`sessions/pre-migration-history.md` under "Decisions from Phase 13."
Cite by ID. Summary:

- **D-1** Multi-aspect items split (federal name vs. marker as separate
  items).
- **D-2** `policy_blocked` status added.
- **D-3** Document state vector (polymorphic by `kind`).
- **D-4** Per-item `jurisdiction_override`.
- **D-5** Custom items as first-class.
- **D-6** Dated one-shot tasks (`due_date`, `event_date`).
- **D-7a/b/c** Structured blockers; chains form a graph; out-of-control
  blockers split by kind (policy vs. personal_circumstance).
- **D-8** Task detail UI hierarchy.
- **D-9** Intent separate from status.

### Phase 18 wave

**D-18A. Document state unification — option (a) chosen.**
[pre-migration — Phase 18D session, 2026-05-15]
Added `physical_document_id?: string` to KB items. UI coalesces entries
with the same id into one row (Settings, onboarding Step 4). Storage
stays per-`ChecklistEntry` — no migration needed. The alternative
(moving DocumentState into `Profile.documents`) was rejected as a larger
schema change for similar UX outcome.

### Migration session

**D-M-1. Accessibility + privacy are pre-community-release, not dogfood-blocking.**
[Clover proposed, Claude confirmed — 2026-05-17]
Both get explicit phases between Phase 20 output and Phase 21. Until
then: accessibility is built with criteria in mind (additive); privacy
is enforced as hard constraints derived from existing posture
(prohibitive). Full treatment in `spec/technical.md` under
Pre-community-release criteria.
