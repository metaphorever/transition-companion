# Transition Companion — Claude Code Instructions

The design document (`transition-companion-design.pdf`) is the single source of truth for all decisions. Read it before making any architectural choice it covers.

---

## Rules that are not optional

These apply in every session, without exception. Do not proceed past this section until each one is confirmed.

**1. Check the model AND effort setting before writing a single line of code.**
Look at the current phase below and the model listed for that phase. If the active model does not match, stop. Tell the user which model this phase requires and ask them to start a new session on that model. Do not write code in the wrong model "just to get started" or "just for the scaffold."

Effort settings by phase:
- Opus phases (dependency graph, onboarding wizard copy, alert copy) → **xhigh**
- Sonnet phases doing non-trivial logic (KB caching, blocker rendering) → **high**
- Sonnet phases doing mechanical work (scaffolding, components, seed data) → **medium**
- **low** is never appropriate for any phase of this project

If the effort setting is wrong, name it and ask the user to adjust before proceeding.

**2. Name scope creep out loud when it happens.**
If the user introduces an idea, feature, or question that is outside the current phase, do not explore it in code. Say clearly: "That's a Phase [X] concern — want me to add a note to CLAUDE.md so we don't lose it, and then get back to what we're on?" Then do exactly that and return to the current task.

**3. When the current phase task is complete, say so and stop.**
Do not roll into the next phase, do not start "just a quick" version of something out of scope, do not keep going because the momentum is good. Say: "Phase [X] task is done. You should commit this, close the session, and open a fresh one for the next task." Then wait.

**4. Do not let a session become a planning session that also writes code.**
If the user wants to talk through ideas, do that — but the moment actual implementation is requested, confirm the phase and model first. Thinking out loud is fine. Typing code is a phase-specific act.

The user knows they tend to get sidetracked. Holding the boundary is helpful, not pedantic. Do it every time.

---

## Before writing any code

Check the current build phase below. The phase determines which model should be active and what scope is in play. If the phase marker says a subsystem is not yet started, do not build it — scaffold only what is needed to support the current phase.

---

## Current Phase

**PHASE: 5 — Item Detail View and Danger Flag System**
**Status: COMPLETE**
**Last session: Full item detail view at `src/components/item-detail/ItemDetail.tsx`. Route `/item/:slug` reads the KB item and checklist entry. Sections rendered in order: `at_risk` user alert (if `entry.status === 'at_risk'`), `revoked` user alert (if `entry.status === 'revoked'`), KB GMC danger/caution/unknown/unavailable/varies banner (if `gender_marker_change.applies && status !== 'current'`), immutable notice, item header (label, description, last_verified, track), presence-level content (rendered for `some_guidance` and `walk_with_me`; suppressed at `just_the_path`), discrimination notes, full process section (summary, documents required, numbered steps with mode labels and step notes, access requirements block, time/cost, official links, KB notes), status selector (all 8 statuses, aria-pressed), personal notes textarea (local state + save on blur), status history (only visible after 2+ transitions), "Something looks wrong" → `/contribute/:slug`. Also: extended `GenderMarkerStatus` to `'caution' | 'varies'` (was missing from type); added `StatusLogEntry` interface and `status_log?: StatusLogEntry[]` to `ChecklistEntry`; store `setItemStatus` now appends a date-stamped log entry on every status change. Build clean, 52 tests pass.**

**Notes for future phases:**

- **Phase 5 carryover — at_risk/revoked alert copy needs Opus review**: The `AtRiskAlert` and `RevokedAlert` components follow all design doc tone guidelines but have not had an Opus review pass. The strings to review are `at_risk_*` and `revoked_*` keys in `src/i18n/en.json`. Run a focused Opus session on those strings alone before Phase 5 ships to real users.
- **Phase 5 carryover — KB-triggered at_risk not yet wired**: `setItemStatus` logs transitions manually, but the flow where a KB update (`gender_marker_change.status → danger`) auto-queues an `at_risk` notice on the user's checklist entry is not implemented. Wire this in `initKB`/`refreshKB` during Phase 8 or 9.
- **Phase 5 carryover — custom items have no detail page**: `/item/:slug` is KB-only. Custom items from quick-add have no detail/edit view. Phase 6 or a post-Phase-6 pass should add this.
- **Phase 5 carryover — legal advice note per-view**: Design doc says once per session is sufficient. Currently appears on each relevant page. Phase 9 can add session tracking if desired.
- **Phase 2 carryover — status semantics**: `complete` and `at_risk` satisfy a document dependency; `revoked` does not. See `SATISFYING_STATUSES` in [src/utils/ordering.ts](src/utils/ordering.ts).
- **Phase 2 carryover — type drift to fix before Phase 6**: `BlockerType` lists `financial` (design doc: `legal | access`). `Blocker` is missing `severity` (`minor | moderate | significant | absolute`) and uses `BlockerResolvable = boolean | 'maybe'` (design doc: `yes | no | maybe | eventually | unknown`).
- **Phase 3 carryover — `documents_response` field**: Phase 9 should expose it for editing alongside `documents_obtained`.
- **Phase 4 carryover — access filter is intentionally simple**: only checks `internet`, `printer`, `phone`. Extend in Phase 6 or 9 if needed.

---

## Phase Map and Model Allocation

Each phase notes the recommended model. These are guidelines — use judgment. Sonnet is the right default for mechanical work. Opus is worth the cost when holding many interlocking constraints simultaneously, or when copy tone is load-bearing.

### Phase 1 — Scaffold and Foundations
**Model: Sonnet**

- Vite + React + Zustand + react-i18next + Tailwind setup
- File and folder structure (match design doc exactly)
- TypeScript types for all data models (Item, Category, Track, Sequence, Jurisdiction, UserData, ChecklistEntry, Blocker, Person)
- localStorage utilities (`storage.js` — read/write/export/import for `tc_user_data` and `tc_kb_cache` separately)
- KB fetching and caching utility (`kb.js` — fetch from GitHub raw CDN, 24h TTL, bundled snapshot fallback)
- i18n scaffolding with `en.json` (all strings externalized from day one — no hardcoded UI copy anywhere)
- React Router shell with placeholder routes for all screens

Nothing is wired together yet. The goal is a working shell with correct structure.

### Phase 2 — Dependency Graph and Ordering Logic
**Model: Opus**

- `ordering.js` — directed dependency graph from `requires`/`required_by` fields
- Logic for which items are "available now" given the user's completed items and current blockers
- Document-type blocker auto-resolution: when a required item is marked complete, document blockers that reference it resolve automatically. User-defined blockers (relationship, safety, readiness, waiting, custom) are NEVER auto-resolved — only the user can mark those resolved.
- "Start here" recommendation logic (one or two items, not a ranked list)
- Unit tests for the graph traversal

This is the most reasoning-intensive utility in the project. Get it right before building UI on top of it.

### Phase 3 — Onboarding Wizard
**Model: Opus**

- All 9 steps (Welcome through Summary)
- Every question is optional; every screen has a visible "Skip for now"
- Progress saved as user goes (closing browser mid-onboarding loses nothing)
- Tone: warm, unhurried, never clinical, never assumes
- Copy must pass the design doc's language constraints (see below)
- Jurisdiction step: country dropdown with search, region populates from country
- Safety/access step: no items hidden based on answers — flags what needs care

Opus is recommended here because the copy requirements are specific and easy to violate under pressure.

### Phase 4 — Dashboard
**Model: Sonnet**

- Progress display (warm label, not percentage, not "X remaining")
- "Available now" section (dependency graph feeds this — never called "easy wins")
- "Start here" (one or two items max)
- Danger flags banner (links to detail, not inline)
- Blocked items visible with "waiting on [X]" label
- Track switcher (legal / medical / social / personal / supporter)
- Access filter toggle
- Quick-add custom item

### Phase 5 — Item Detail View and Danger Flag System
**Model: Sonnet for structure, Opus for alert copy**

- Item name, description, process steps with mode labels
- Access requirements, estimated time and cost, official links
- Status selector (all six statuses)
- Danger/caution/unknown banners — see alert messaging guidelines in design doc
- Immutable item notice with compassionate copy
- Discrimination note (empowering framing, not alarming)
- Presence-level content rendering
- Personal notes field
- "Something's wrong with this information" → contribution flow

Alert copy for `at_risk` and `revoked` states should be reviewed in an Opus session. The tone requirements are the most specific in the entire project.

### Phase 6 — Blocker System UI
**Model: Sonnet**

- Add/edit/remove blockers on any item
- All seven blocker types with correct field display per type
- Relationship blockers surface the people map for selection
- `suppress_workaround` toggle per blocker
- Workaround surfacing at `some_guidance` and `walk_with_me` presence levels only (not proactively at `just_the_path`)
- Dashboard "waiting on [X]" label pulls from active blockers

### Phase 7 — People Map
**Model: Sonnet**

- Optional, private, never presented as something to complete
- Add/edit person records with all fields (relationship, out_to, out_status, safety_level, support_level, contact_frequency, items_they_need_to_update, user_notes)
- Lives in social track and profile/settings area
- Surfaces when: adding a relationship blocker, viewing social coming-out items, reviewing "Things Others Need to Update"
- Never used to judge or prompt action about any person

### Phase 8 — KB Seed Data
**Model: Sonnet**

Write the initial JSON files for the KB repository (`transition-kb`). Build these first, in order, with current and accurate data:

1. Social Security Administration (name change only — gender marker flagged `danger`)
2. Illinois Driver's License / State ID (includes gender marker X)
3. Illinois Vital Records (birth certificate)
4. US Passport
5. US Passport Card
6. Illinois Voter Registration
7. USPS Informed Delivery
8. Federal Student Aid / FSA ID
9. IRS (note: name auto-updates from SSA)
10. Bank of America, Chase, Wells Fargo, generic bank template
11. Generic employer HR template
12. Generic health insurance template
13. Google Account, Apple ID, Amazon, Netflix (display name), Hulu (display name)
14. US Marriage Certificate (immutable — with compassionate copy and workarounds)
15. Informed Consent resource item
16. LGBTQ+ health center directory resource item

Each file must validate against `item.schema.json` and include a `last_verified` date and `status_date` on any status field.

### Phase 9 — Contribution Flow and Settings
**Model: Sonnet**

- Settings screen (all onboarding answers editable)
- Export / Import / Clear (import confirms before overwriting; clear always prompts export first)
- Contribution flow: pre-filled GitHub issue template (no account required) or JSON for PR (account required)
- Personal notes are never included in contributions — only process knowledge
- Contributor settings: three independent dials (privacy, prompting, involvement)

### Phase 10 — Presence Level System (rendering pass)
**Model: Sonnet**

- `just_the_path`: checklist, status, notes, steps, links. No extra prompts.
- `some_guidance`: adds inline context, occasional prompts when completing unlocks something, suggested next steps (offered, not pushed)
- `walk_with_me`: adds reflective nudges, proactive resource surfacing, open_doors content
- `open_doors` is independent of presence level
- Per-track overrides work correctly
- Presence level affects rendering only — all data is always accessible at every level

---

## Language constraints (enforced throughout)

These apply to every string in the app, including error messages. When in doubt, check the design doc's "Tone in Copy" and "Alert Messaging Guidelines" sections.

- Never use the phrase "easy wins" anywhere
- Never say "unfortunately" or "we're sorry"
- Never perform sympathy — the app is steady, not grieving
- No emoji anywhere in UI, copy, components, or KB files
- No motivational micro-copy that feels performative
- Error messages: plain language, say whether data is safe, offer a next step, no HTTP codes or stack traces

---

## Open design questions (resolve before building the affected phase)

- **Dependency graph: computed, and completion does not cascade** (decided): The dependency graph is a pure computed function. On each load, it reads current checklist statuses + KB `requires` fields and derives which items are currently blocked by missing documents. Document blockers are never stored as records — they are always derived. User-defined blockers (relationship, safety, readiness, waiting, custom) remain stored records because only the user can resolve them.

  Critically: completing a required item makes dependent items *available*, not *complete*. SSA complete → driver's license moves from "unavailable" to "available now" on the dashboard. The driver's license status remains `not_started` (or whatever the user last set it to) until the user explicitly completes it. The app never changes an item's status automatically based on another item's completion. Having the key does not open the door — it means the door can now be opened. What happens next involves steps the user has to take, and may involve other blockers (safety, relationship, readiness) that exist independently of the document dependency. Do not implement any cascade or auto-complete behavior.

- **Quick-exit / privacy mode** (noted out of scope for v1 but architecture must not preclude it — keep in mind during Phase 4 and Phase 9)

---

## Model switching notes

Each major phase should be a new Claude Code session, not a mid-session model switch. Starting fresh is cheaper (Opus doesn't inherit a long context to process on every response) and produces cleaner output (no drift from prior decisions).

Workflow for Opus phases:
1. Commit all current work to git before starting
2. Start a new session
3. Reference this file and the design doc in the opening prompt
4. Keep the session focused on one subsystem only
5. Commit the output before switching back to Sonnet

Sonnet is the correct default. Only switch to Opus for the phases marked above.

---

## Session hygiene (cross-session continuity)

Phases run in separate worktrees. Without discipline, the next worktree starts on stale code and you waste a turn fast-forwarding (or worse, you build on the wrong base and have to merge).

**At the end of every phase session — before saying the session is done:**

1. Commit all phase work, including the CLAUDE.md update that marks the phase complete and records carryover notes. CLAUDE.md updates go in the same commit as the phase work, not a separate one — that way `git log` tells the full story.
2. Merge (or fast-forward) the worktree branch to `main` and push to `origin/main`. Do not leave phase work sitting only on a feature branch — the next phase will branch from main and miss it.
3. **Standing permission**: the user has authorized end-of-phase commits and fast-forward pushes to `origin/main` without re-asking each time. Use `git push origin <branch>:main` from the worktree to fast-forward main directly. Still surface the proposed commit message and the push target before running so the user can object — just don't block waiting for an explicit yes. Force-push to main is never permitted; if a fast-forward isn't possible, stop and ask.

**At the start of every phase session — before writing any code:**

1. Confirm model + effort match the current phase (rule #1 above).
2. `git fetch origin && git status` — if the worktree branch is behind main, run `git merge --ff-only origin/main`. If fast-forward fails, stop and reconcile with the user; do not write code on top of a divergent base.
3. Read the "Current Phase" block. The "Last session" line and carryover notes are the bridge from the previous session — trust them, but verify any specific file/symbol they reference still exists before relying on it.

**Carryover notes — what belongs in CLAUDE.md vs. in code:**

- In CLAUDE.md: decisions, type drift, deferred refactors, architectural caveats the next phase needs to know but couldn't infer from reading the code.
- In code comments: the *why* for non-obvious local choices (already a project default).
- Not in CLAUDE.md: anything `git log` already tells you, or anything the next session can find by reading the file in question.

Keep the carryover list short. If it grows past ~6 bullets per phase, prune the ones that no longer apply.
