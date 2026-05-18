# Session — 2026-05-17 — Migration: Transition Companion

## Session setup
- Model / Effort / Uncertainty: Opus 4.7 · high · standard
- Open holds: none (migration session)
- Git: started in worktree `upbeat-hermann-9ad10e`; migration work performed
  in main checkout on branch `migrate-to-template-workflow`

## What shipped

- Installed new template files at project root:
  `CLAUDE.md`, `CLAUDE-REFERENCE.md`, `ROADMAP.md`. `[Project Name]`
  placeholders filled with "Transition Companion."
- Archived prior CLAUDE.md to `sessions/pre-migration-history.md` with a
  one-paragraph archive header. Git detected the rename (CRLF-vs-LF on the
  user's working copy duplicate was confirmed identical to the tracked
  file).
- Wrote `spec/product.md` after an interview pass. The vision drift from
  the original design doc was acknowledged in the spec — particularly the
  "never-ending process" framing and the "build with the community in the
  roots" stance, both of which are sharper now than in the original pitch.
- Wrote `spec/technical.md` capturing current architecture, stack,
  conventions, build/test, git workflow, and dependencies-without-explicit-
  tradeoffs.
- Added a **Pre-community-release criteria** section to `spec/technical.md`
  distinguishing additive accessibility criteria from prohibitive privacy
  constraints.
- Added a **Build commands** block and a **Worked examples** section to
  `CLAUDE-REFERENCE.md`. Worked-examples-#1 is the photo-timeline /
  health-logging worked example of Rule 10 (complexity must be justified).
- Drafted `ROADMAP.md` with phase map, backlog, open design questions,
  decisions log. Pulled decisions D-1 through D-9 by ID from
  `sessions/pre-migration-history.md` rather than reproducing them.
- Updated CLAUDE.md current phase block to **Phase 19 — Second Dogfood
  Review** with the dogfood-window testing hold recorded.

## Decisions made

- **D-M-1. Accessibility + privacy are pre-community-release, not
  dogfood-blocking.** [Clover proposed, Claude confirmed]
  Recorded in `ROADMAP.md` decisions log and operationalized in
  `spec/technical.md`. Privacy is enforced as prohibitive constraints
  derived from existing posture; accessibility is built with additive
  criteria in mind. Each gets an explicit phase between Phase 20 output
  and Phase 21.
- **Phase A and Phase P (accessibility, privacy) placeholder phases
  between 20 and 21.** [Claude proposed, Clover confirmed via ROADMAP
  sign-off]
  Phase numbers deferred to Phase 20 scoping.
- **Phase 19 stays as next phase, gated on real 2–3 week dogfood window.**
  [Claude proposed, Clover confirmed via framing of "doesn't block dev
  right now"]
- **localStorage quota strategy and Python build chain stability are
  pre-community-release blockers, not v1 dev blockers.** [Clover
  proposed, Claude confirmed]
  Recorded in `ROADMAP.md` items pending phase assignment.
- **Photo timeline / health logging — stub task template only, no
  dedicated infrastructure.** [Clover proposed, Claude confirmed]
  Codified in `spec/product.md` out-of-scope section and in
  `CLAUDE-REFERENCE.md` worked-examples.

## Uncertainty flags

- **CLAUDE-REFERENCE.md template did not include a build commands block**
  despite MIGRATION.md Step 4 telling me to fill one in. Added a new
  section. Possible template gap upstream.
- **Tone-rules bullet in `spec/technical.md` points to
  `CLAUDE-REFERENCE.md`** as a reference, but the actual tone rules
  currently live in `sessions/pre-migration-history.md` and have not been
  inlined into either spec. Flagged but not fixed this session — next
  touch should either inline them into `spec/technical.md` or move them
  into `CLAUDE-REFERENCE.md` as a worked-example-style block.

## Testing holds

- **Dogfood window** — Phase 19 does not open until Clover has used
  18B/C/D in personal daily-use for 2–3 weeks. Recorded in CLAUDE.md
  current phase block and in `ROADMAP.md`.

## Carryover

- Phase 19 should pin a phase number for **pronouns / names model
  expansion** (currently parked under "items pending phase assignment").
- Phase 20 assigns real phase numbers to Phase A (Accessibility) and
  Phase P (Privacy).
- The dogfood notes Clover is keeping outside the repo feed Phase 19
  categorization. They do not live in the repo by design (per the
  no-server, tool-not-service posture).
- One unresolved nit: the tone-rules pointer described under
  "Uncertainty flags" should be cleaned up the next time
  `spec/technical.md` or `CLAUDE-REFERENCE.md` is touched.

## Deferred / added to roadmap

All items captured in `ROADMAP.md`:
- Backlog additions: ICS export, multi-time-per-day recurring,
  calendar-based recurrence patterns, per-reminder surfacing window
  (D4), onboarding priority capture (D3), dark mode (D1), user-story
  test suite (D6), expanded KB coverage, contribution pipeline
  maturation, quick-exit pattern, Bucket 4 dep map wiring, separate
  companion projects (photo / health / versatile-tracker).
- Open design questions: quick-exit pattern, dark mode promotion,
  pronouns/names model expansion, health-logging companion integration
  story, KB `required_by` unpopulated state.
