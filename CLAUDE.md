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

**PHASE: 18D — Document State Unification**
**Status: NOT STARTED.**
**Model: Sonnet · Effort: high**
**Previous phase (18C — KB Dependency Map): COMPLETE. Shipped 2026-05-15.**

**Phase 18C carryover notes:**
- **Three-file cycle is live.** Generator (`scripts/generate_dependency_map.py`) → canonical (`transition-kb/_dependency-map.mmd`) → validator (`scripts/validate_dependency_map.py`). Generator runs as `prebuild` hook; validator runs via `npm run validate-deps`.
- **Canonical bootstrapped.** `_dependency-map.mmd` is a copy of the generated file. It is the hand-editable working model — add soft edges (`-.->`) and wire intentionally-standalone items to `_standalone` here. The generator never overwrites it.
- **Bucket 4 has 16 unclassified isolated items.** These are items with no hard edges in either direction that have not yet been wired to `_standalone` in the canonical. The list: `amazon-account`, `apple-id`, `find-a-name`, `google-account`, `health-insurance-generic`, `hulu-account`, `il-birth-cert`, `informed-consent`, `lgbtq-health-centers`, `netflix-account`, `social-name-change`, `ssa-marker`, `us-marriage-cert`, `us-passport-card-marker`, `us-passport-marker`, `usps-informed-delivery`. Wire each to `_standalone` (intentional) or add a `requires` edge in JSON as edges become clear. This is an ongoing editorial task, not a blocker.
- **Soft edges are canonical-only and design-only.** They never go in JSON `requires`. Phase 16 carryover noted that `find-a-name -.-> social-name-change -.-> ssa-name` is a plausible soft chain — add these to the canonical when the time feels right.
- **Node IDs use underscores; slugs use hyphens.** The generator converts `ssa-name` → `ssa_name` in Mermaid. The validator converts back. This mapping is consistent and reversible — no ambiguity.

**Phase 18B carryover notes:**
- **B18-1 jurisdiction stub spawning** — `diffBirthJurisdictionStubs()` in `src/utils/onboarding.ts` and `syncBirthJurisdictionStubs()` store action are complete. `groupItemsByTrackAndCategory` now accepts a `birthJurisdiction` parameter and uses it for items with `jurisdiction_scope: 'birth'`. Currently only `il-birth-cert` has `jurisdiction_scope: 'birth'`. As new birth-cert KB items are added for other regions, they should also carry `jurisdiction_scope: 'birth'`.
- **Correction-vs-move dialog (Settings → Location)** — The dialog intercepts any change to `profile.jurisdiction` when an existing value is present. "Correcting a mistake" replaces cleanly; "I moved" archives the old jurisdiction to `other_jurisdictions` and calls `syncBirthJurisdictionStubs`. The dialog is inline (no modal) — it replaces the pickers temporarily then restores them.
- **`never_expires` on KB items** — Set on `il-birth-cert`, `ssa-name`, `ssa-marker`, `us-marriage-cert`. When true, the expiration_date picker is hidden in both `DocumentStateSection` (ItemDetail) and `DocStateRow` (Step4Documents). New items that don't expire should carry this flag.
- **B18-3 "Update when possible"** — UI-only label for the `update` intent button when `status === 'policy_blocked'`. The stored enum value is still `'update'`. Applied in ItemDetail and BulkIntentEditor (ItemRow now accepts optional `status` prop).
- **B18-5 blocker label stacking** — All four dashboard sections (Active/Working/Waiting/Someday) now stack the blocker/status sublabel below the item title. The right-side flex cluster retains priority badges, expiry warnings, and track labels only.
- **Phase 19 review** — Still needs to run after Phases 18B/18C/18D ship and a real 2–3 week dogfood window has happened.

**Phase 19 carryover notes (from 2026-05-14 triage):**

**Phase 19 carryover notes:**
- **Phase 18B (display/correctness, Sonnet medium)** — six fixes: B18-1 birth-jurisdiction filter + stub spawning for unmodeled jurisdictions (mirrors aspiration_skeleton; new provenance value `'jurisdiction_stub'`, new optional field `jurisdiction_stub_for?: { kb_slug: string; jurisdiction: Jurisdiction }`); B18-2 Step 8 BulkIntentEditor card layout; B18-3 policy_blocked visual treatment + intent label "Update when possible" (UI/copy only, no enum change); B18-4 Step 10 review uses real custom-item titles, not internal IDs; B18-5 dashboard "waiting on [X]" stacks vertically and wraps; B18-6 parts 1+2 — aspect-correct DocumentState picker labels (driven by entry `kind`) and new optional `never_expires?: boolean` on KB items that hides the expiration_date picker (birth cert, SSA card, marriage cert).
- **Phase 18C (KB dependency map, Sonnet medium)** — generator `scripts/generate_dependency_map.py` emits `transition-kb/_dependency-map.generated.mmd` (per-track subgraphs, edges from `requires`, hard edges solid `-->`). Canonical hand-edited file at `transition-kb/_dependency-map.mmd`. Validator `scripts/validate_dependency_map.py` reports drift but never fails the build. Generator wired into `npm run build` as a pre-build step. Soft Mermaid edges (`-.->`) are design-only and never encoded into JSON `requires` — future surfacing of soft relationships into `walk_with_me` suggestions is plausible but out of scope for 18C.
- **Phase 18D (document state unification, Sonnet high)** — B18-6 part 3. Split items like `ssa-name` and `ssa-marker` collapse into one physical-document entry on the document-state UI while staying separate checklist entries. Architectural pick at session start: (a) add `physical_document_id?: string` to KB items, UI coalesces; or (b) move DocumentState out of `ChecklistEntry` into `Profile.documents` keyed by physical document. Affects Settings, onboarding Step 4, and any reader of `ChecklistEntry.document_state`.
- **D18-1 (visual dependency map)** is satisfied by Phase 18C.
- **Pronouns/names model expansion moved from v2 to pre-beta-tester sequence.** Not a personal-dogfood blocker (developer's own situation is fine); a real concern only when external testers come through with multi-name, multi-pronoun, or plural-system contexts. Slotted for after Phase 19 and before Phase 21, no firm phase number yet.
- **Phase 18 never wrote its own carryover block.** Deploy shipped in commits 15378f6 (`.htaccess` + first-person-plural copy fixes) and acb3f34 (privacy posture guidelines + dogfooding-phase18.md). The dogfooding notes file is the de-facto Phase 18 carryover. Phase 18 is COMPLETE for the deploy portion; the dogfood portion remains thin and is what Phase 18B/C/D + a real dogfood window are unblocking.
- **Open questions not resolved this session** — quick-exit/privacy mode (re-evaluate as beta-tester blocker before Phase 20) and dark mode/D1 (same). Both recorded under Open design questions; both not personal-dogfood blockers.

**Previous phase (17 — Wave 6: Contribution Surfacing + Completion-Moment Hooks): COMPLETE.**

**Phase 17 carryover notes:**
- **New `/contribute-review/:slug` route** (`src/components/contribute/ContributeReview.tsx`) — the "share what I learned" flow, distinct from the existing "report an issue" form at `/contribute/:slug`. Handles both KB items and custom items (`isCustom` flag derived from whether slug matches a custom item vs. KB item). Builds a pre-filled GitHub issue or JSON snippet. Two zones: shareable fields (process notes, links, time, cost — all optional) and a private zone showing personal notes read-only, clearly labeled as never-included.
- **`CompletionAck` now context-aware.** Props changed: `{ completedAt, slug, contributorSettings }`. When `prompting_level !== 'off'`, a second row appears with two links: "add a note while it's fresh" (anchors to `#notes-heading`) and "want to contribute this to the guide?" (navigates to `/contribute-review/:slug`). Both KB and custom item detail pages pass contributor settings; KB items pass the URL `slug`, custom items pass `item.id`.
- **Dashboard unknown intent section** below Someday. Shown only when `presence_level === 'walk_with_me'` OR `prompting_level === 'proactive'`; suppressed when `prompting_level === 'off'`. Items with `intent === 'unknown'` in the checklist (explicitly set, not silent). Gentle framing — "not sure about", badge says "not sure".
- **Contributor walkthrough in Settings** (`ContributorSection`). Shown when `involvement_level === 'contributor'` and `!seen_contributor_walkthrough`. Explains GitHub issue vs. PR paths. Dismissed via `patchProfile({ contributor_settings: { ...settings, seen_contributor_walkthrough: true } })`. New `seen_contributor_walkthrough?: boolean` on `ContributorSettings` type; default `false` in storage, merged correctly by existing `contributor_settings` spread in `mergeWithDefaults`.
- **C12 verified and working.** Phase 9 shipped the infrastructure (settings capture, onboarding step, `/contribute/:slug` form, "report issue" link in item detail). Phase 17 wired the runtime behavior: prompting_level / privacy_level are now read at runtime. The "report issue" link at the bottom of item detail is unchanged — it's still there for the "something is wrong" path. The new "contribute what I learned" path surfaces on completion only.
- **Aspiration skeleton items** (Phase 14 carryover) — still no contribution hook tied to `provenance: 'aspiration_skeleton'` custom items. Phase 18 or later can add a targeted nudge ("you built this path yourself — want to contribute it?") on completion of skeleton items specifically.

**Previous phase (16 — Wave 5: Item Detail UX + People Map Expansion + Name-Finding Flow + Social Name Change): COMPLETE.**

**Phase 16 carryover notes:**
- **ItemDetail hierarchy reordered (D-8 implemented).** New order: Alerts → title → Status → Intent → CompletionAck → BlockersSection → SubTasksSection → WalkthroughSection → Notes → DocumentState → DatesSection → History → Report. `WalkthroughSection` is a collapsible wrapper (collapsed by default) around presence content, discrimination notes, ProcessSection, and UnlocksHint. `CompletionAck` is a quiet inline panel (shown when status === 'complete') with completed date + back-to-dashboard link. Same reorder applied to `CustomItemDetail`.
- **B4 safety menu dedup done.** The `unknown` (“Not sure”) option was removed from the SafetyLevel UI — only `unsure` (“Unsure”) remains. Both were near-identical options. The type still includes `unknown` for any existing stored data; UI just doesn't offer it as a new pick.
- **`OutToLevel` enum replaces boolean `out_to`.** Four values: `'not_now_not_ever' | 'not_yet' | 'partially' | 'completely'`. Migration in `mergeWithDefaults`: `true → 'completely'`, `false → 'not_yet'`. `isOutToSomeone()` helper returns true for `'partially' | 'completely'`. `isNotOut()` returns true for `'not_now_not_ever' | 'not_yet'`. `out_status` field in PersonForm only shown when `isOutToSomeone`. `items_they_need_to_update` replaced with a note when person is not-out or support level is resistant/hostile. `ThingsToUpdateSection` now filters to people who are out-to. New `WhoCanKnowSection` (collapsible, collapsed by default) lists all partially/completely out-to people — derived, not stored.
- **New KB items: `find-a-name` and `social-name-change`.** Both are social track, `social-identity` category. Content is intentionally minimal (3 skeletal steps each, one external link each) per new content philosophy. Full copy polish deferred to an Opus pass. A new KB category file `transition-kb/categories/social-identity.json` was created to support the snapshot rebuild.
- **KB snapshot rebuild requires full object dicts, not slug arrays.** The Python rebuild script must load full JSON from each category/track/condition file and key them by slug — `categories: Record<string, Category>`, not `string[]`. The `BundledSnapshot` TypeScript type enforces this. If a future rebuild produces slug arrays for these fields, it will fail the TS build with a type mismatch on `categories`.
- **Step 2 onboarding name opt-in**: “I don't know yet” checkbox appears below the name input when the name field is empty. Checking it adds `find-a-name` to the checklist immediately via `addItemToChecklist`. The checkbox is hidden once the user enters a name.
- **Age tracking noted for future phases.** User flagged that age (derivable from birth records if filled out) is relevant to healthcare and rights logic. Saved to project memory. Not in scope for any current phase — will need a nudge in the onboarding birth-jurisdiction step and a consent-aware read path when the logic consumes it.
- **Opus pass deferred**: completion-moment copy (CompletionAck), name-finding task content (find-a-name and social-name-change skeletal steps + descriptions), people-map empty/skip states. These are editorial, not structural — code is already correct, copy is placeholder-quality Sonnet.
- **`unsure` priority recurring check-in reminders** (Phase 15 Stage C carryover idea): same machinery as personal-circumstance re-check reminders — a linked `RecurringItem` per `priority === 'unsure'` checklist entry. Still deferred; threads into Step 7, Settings, item-detail priority picker, dashboard. Not picked up in Phase 16.

**Phase 15 cross-stage notes (still load-bearing for Phase 17):**
- **Deprecated blocker fields are gone, but `mergeWithDefaults` does not strip them on import.** Old user exports keep stale `label`/`kb_dependency`/`person_ref`/`user_defined`/`severity`/`resolvable`/etc. fields in storage until the user touches the blocker. If that bites in dogfooding, add a one-pass cleanup in storage migration.
- **Breadcrumb trail uses `?trail=` query param**, stacked comma-separated, immediate parent at the end. Survives refresh. `BreadcrumbBackLink` in `ItemDetail.tsx` pops the last entry; arbitrary-depth chains supported. `buildDrillInHref` in `BlockersSection.tsx` is the canonical builder.
- **`KBCache.conditions` is required.** Anywhere that constructs a `KBCache` literal (network fetch, snapshot fallback, test mocks) needs to provide it. Defensive read in `storage.readKBCache()` fills `conditions: {}` for pre-Phase-15 stored caches.
- **KB conditions seeded:** `federal-marker-policy` (covers SSA / passport / passport-card markers) and `us-marriage-policy` (covers us-marriage-cert). Other immutable items can get `kb_condition_ref` set in later phases as needed.
- **Reverse-lookup scan is O(checklist entries × blockers per entry).** Computed in `findParentsReferencingTask` via a `useMemo` keyed on `userData.checklist`. Fine at current scale; if KB grows past a few thousand entries with deeply-blocked items, consider hoisting into a derived store selector.

**Previous phase (15 — Wave 4: Blocker Model Rework): COMPLETE.**

Phase 15 shipped. Three stages: Stage A (blocker schema rewrite + KB conditions plumbing), Stage B (dashboard reshape + item-detail blocker UI rewrite), Stage C (KB condition policy-changed flow + personal-circumstance re-check reminders). `addRecurringItem` now returns `string`. `KBCache.conditions` is required. Mojibake fixed in snapshot. See Phase 15 notes above for detail.

**Previous phase (14 — Wave 3: Onboarding Overhaul): COMPLETE.**

Phase 14 shipped. Significant scope expansion beyond original spec: an aspiration-layer priority field (`'now' | 'soon' | 'someday' | 'unsure'`) was added alongside the spec'd intent picker after the user identified that the original 4-value intent didn't capture timing/urgency. The `unsure` priority specifically targets "things I have feelings about but am not ready to confront" — surfaces in soft sections for gentle later-nudges.

**What shipped:**
- Schema additions in `src/types/index.ts`: `ItemPriority` (`'now' | 'soon' | 'someday' | 'unsure'`); polymorphic `DocumentState` (`'name' | 'marker' | 'full'` discriminated kind, each with `name_status`/`marker_status` of `DocFieldStatus = 'old' | 'new' | 'in_progress' | 'unknown'`, `issued`, `expiration_date` where applicable); `Profile.birth_jurisdiction?`, `Profile.other_jurisdictions?`, `Profile.onboarding_aspirations?`, `Profile.onboarding_aspirations_applied?`; `ChecklistEntry.priority?`, `ChecklistEntry.revisit_at?`, `ChecklistEntry.jurisdiction_override?`, `ChecklistEntry.document_state?`; `CustomItem.provenance?` (`'user_created' | 'aspiration_skeleton'`) and `CustomItem.aspiration_slug?`.
- Store actions: `setItemPriority`, `setItemRevisitAt`, `setItemDocumentState`, `setItemJurisdictionOverride`.
- Onboarding restructured to 10 steps (was 9). New `Step7Direction` (broad aspirations + priority across major aspects) and `Step8BulkIntent` (grouped/searchable/per-category mark-all bulk-intent picker) inserted; old `Step8Contributor`/`Step9Summary` renamed to `Step9Contributor`/`Step10Summary`. Step 7's aspiration choices flow into Step 8 as prefilled items (intent=update + priority from aspiration) plus skeleton custom items for aspirations with no KB match in the user's jurisdiction.
- Step 3 (Location) extended with birth_jurisdiction + other_jurisdictions (collapsible). Step 4 (Documents) rewritten: per-item document-state capture, opt-in per item, skip-and-decide-later default.
- `BulkIntentEditor` extracted as a shared component (`src/components/onboarding/BulkIntentEditor.tsx`) used by Step 8 and by Settings. Step 8 wraps it with the aspiration-prefill effect; Settings uses it bare.
- Settings: added `BirthJurisdictionSection`, `OtherJurisdictionsSection`, `AspirationsSection`, and `BulkIntentSection`. Legacy `DocumentsSection` (`documents_obtained`) left intact for backwards compatibility.
- Dashboard: active list sorted by priority (`now` → `soon` → unset → ordering), `someday`/`unsure` items routed to a new soft "Someday" section, priority badge rendered on cards, `revisit_at`-due items surface as a top-of-dashboard nudge banner, expiration_date within 90 days surfaces as a quiet "expires {date}" indicator on item rows.
- ItemDetail: `DatesSection` extended with priority picker + `revisit_at` date input; new `DocumentStateSection` renders for items in `ONBOARDING_DOC_STATE_ITEMS` registry (or where doc state is already captured).
- Aspiration registry in `src/utils/onboarding.ts`: 8 aspirations across legal/medical/social/personal tracks, each with `implementing_slugs` (KB items that satisfy it), `skeleton_category`, and `skeleton_steps` (broad-strokes pathway content for non-modeled jurisdictions). Resolution function `resolveAspirations()` maps aspiration → priority → matched KB slugs vs. spawn-skeleton.
- Storage migration: all new fields optional on ChecklistEntry — existing entries keep `priority`/`revisit_at`/`document_state` undefined (no data loss). `DEFAULT_USER_DATA.profile` gets `birth_jurisdiction: null`, `other_jurisdictions: []`. `mergeWithDefaults` exported for unit tests.
- Tests written in `src/utils/storage.test.ts` covering: legacy entries get undefined new fields; new fields preserved through migration; polymorphic document_state kinds preserved; CustomItem provenance/aspiration_slug preserved; Phase 13 marker migration unaffected. Tests do not need to be re-run for Phase 13 carryover items.
- i18n: ~80 new strings added covering all new copy (direction step, bulk intent step, document state controls, priority labels, revisit, expiry indicators, settings sections).

**Phase 14 carryover notes:**
- **Aspiration-layer priority is a Phase 14 scope expansion beyond the original spec** — added at user direction during this session. CLAUDE.md's Phase 14 phase-map section may be edited later to reflect this. The decision is documented as D-9-extension: `priority` field on `ChecklistEntry`, orthogonal to `intent` and `status`. `'unsure'` priority specifically supports "I have feelings about this but am not ready to confront it yet" — gentle later-nudges welcome.
- **`documents_obtained` field is now legacy** — Step 4 no longer populates it. The new per-item `document_state` is the primary signal. `documents_obtained` is still read by `getSatisfiedSlugs()` in `ordering.ts` for backwards compatibility with users who have it populated, and Settings still exposes the legacy controls. Future phases may deprecate it entirely once `document_state` adoption is broad enough; until then, it's an orthogonal signal that does no harm.
- **Item splits per Phase 13 + skeleton spawning interaction**: when a user has `gender-marker-change` aspiration but is in a US jurisdiction, the resolver matches the marker items (`ssa-marker`, `us-passport-marker`, etc.) which are all `immutable: true` and thus auto-set to `policy_blocked` by Phase 12's `useEffect` on first open. Result: aspiration → items added to checklist with intent=update + priority=now (or whatever user picked) → user opens them → they become policy_blocked → they appear in the dashboard's "Currently not possible" section, not the active list. This is correct behavior; just be aware that picking `gender-marker-change` in the direction step doesn't put marker items in the active list under current US policy.
- **Aspiration skeleton items use generic broad-strokes content** — the `skeleton_steps` arrays in `ASPIRATIONS` are jurisdiction-free. When the user is in a country we haven't modeled, these spawn as custom items with `provenance: 'aspiration_skeleton'` and `aspiration_slug` set. The Phase 17 contribution-flow work should pick this up and offer a "contribute what you learn back" hook tied to contributor settings. Currently the skeleton is added as a custom item with a placeholder description; no sub-tasks are pre-populated (would clutter the detail page). Future phase can populate sub_tasks from `skeleton_steps` on creation.
- **`jurisdiction_override` field is declared but no UI consumer wired this phase**. The schema is in place for future use (e.g. "this birth cert task applies to my birth jurisdiction, not residence"). Phase 16 or later can add UI when item-detail UX is reorganized per D-8.
- **Priority sort on Dashboard sorts within `availableNow` only** — the blocked/policy_blocked/completed sections aren't priority-sorted because their secondary attributes already organize them. Sub-task overdue flags, expiry warnings, and track labels all render alongside the priority badge on the same row.
- **Revisit-due banner is a top-of-dashboard nudge, not a separate section** — it surfaces just the labels with links to the items themselves. Doesn't duplicate the items in their proper section.
- **Expiry warning surfaces at 90 days** (`EXPIRY_WARNING_DAYS` in `Dashboard.tsx`). Adjust the constant if a different window is preferred. Past-expiration uses amber tint; future-but-within-90 uses neutral.
- **KB content philosophy — "authoritative reference > broad steps"** (carryover principle from this session, not Phase 14 code): During the planning conversation, the user directed that the canonical suggested KB content should be as lean and adaptable as possible. The pattern should be: find the authoritative reference (BoA's name-change help page, the USPS page, etc.) → link to it → list only broad/skeletal steps (e.g. "by mail or in person — find a location") → defer to the authoritative source for full process detail. Reasons: keeps the DB small, keeps content fresh by deferring to the source of truth, makes contribution easier (link + sketch beats summarize + maintain). Apply this when writing or revising any KB item content. **Existing KB content does not yet follow this pattern** — most items currently summarize process steps in full. This is a content pass to make incrementally during future content sessions, not a Phase 14 code task.
- **Per-jurisdiction "intent vs. pathway" KB split**: The user identified that aspirations and KB items currently conflate "I want to do this" with "here are the steps for jurisdiction X." The aspiration model in `ASPIRATIONS` is the bridge — it captures aspiration-level intent independent of pathway. A more thorough KB schema split (separating aspiration-items from pathway-items) is a Phase 15+ design call. The Phase 14 aspiration model leaves the door open without requiring that schema change yet.

**Previous phase (13 — Wave 2: Multi-Aspect Item Split + KB Content Refresh): COMPLETE.**

Item splits shipped: `ssa-name` (label updated to "Social Security Administration — Name Update") stays as-is; new `ssa-marker` created. `us-passport` renamed to `us-passport-name` (old file deleted); new `us-passport-marker` created. `us-passport-card` renamed to `us-passport-card-name` (old file deleted); new `us-passport-card-marker` created. `fsa-id` and `irs-name` were NOT split — both have `gender_marker_change.applies: false` in the KB data, so no marker variants exist for them. `irs-marker` and `fsa-id-marker` as described in the spec were skipped as they would be inaccurate.

All three marker items (`ssa-marker`, `us-passport-marker`, `us-passport-card-marker`) are `immutable: true` — reusing Phase 12's auto-set-to-`policy_blocked`-on-first-open behavior. Phase 15's KB-conditions model is the proper home for tracking "policy may change" — for now immutable is the pragmatic call.

Storage migration in `src/utils/storage.ts`: renames `us-passport` → `us-passport-name` and `us-passport-card` → `us-passport-card-name` checklist entries; seeds `policy_blocked` + `intent: 'update'` marker entries for any user who had engagement with the corresponding name item.

`recovery_items` added: `il-dl` gets `["ssa-name", "il-birth-cert"]`; `ssa-name` gets `["il-birth-cert"]`.

`transition-kb/index.json` and `il-legal-name.json` sequence updated to use new slugs. `public/kb-snapshot/index.json` rebuilt from source (Python script, no Node required — Node not in sandbox PATH).

**Phase 13 carryover notes:**
- **B6 alert copy is draft/placeholder Sonnet copy** — all three marker items have factually accurate descriptions and status_notes, but tone has not been through Opus review. Per user direction, Opus copy polish is deferred to pre-public-beta, not a blocking concern for ongoing development.
- **Phase 13 tests**: ordering tests use generic mock slugs — no actual KB slug references that need updating in this phase. `recovery_items?: string[]` and `policy_blocked` are both present in `src/types/index.ts`.
- **Old `us-passport.json` and `us-passport-card.json` deleted** — if any user data export from before this phase is imported, the migration in `mergeWithDefaults` handles the rename. The old files are gone from the repo.

**Previous phase (12 — Wave 1: Bugs + Intent Field + Custom Items First-Class + Immutable Handling): COMPLETE.** All Phase 12 items shipped. Schema: added `ItemIntent` type, `policy_blocked` and `researching` to `ItemStatus`, `intent?`/`due_date?`/`event_date?` to `ChecklistEntry`, `start_date?` to `RecurringItem`, `description?` to `CustomItem`. Bugs A1–A6 fixed (scroll-to-top, iOS zoom, track-scope warning, dashboard intent filter, timezone-safe date arithmetic via `localDateString()` in `src/utils/recurring.ts`, page title). Storage migration back-fills `intent: 'update'` on existing checklist entries and creates default `ChecklistEntry` records for existing custom items. Custom items are now first-class: full detail page with edit/delete, sub-tasks, blockers, intent, dates (C1). Immutable KB items auto-set to `policy_blocked` on first open and live in a collapsible "Currently not possible" section on the dashboard (C2). Dated one-shot tasks: `due_date`/`event_date` on `ChecklistEntry`, surfaces within 30 days on dashboard (C5). `start_date` on `RecurringItem` as fixed-mode anchor before first log (C4). 72 tests passing, clean build and type-check.

**Phase 12 carryover notes:**
- **`description?` on CustomItem is optional**: kept optional (not required) to avoid breaking onboarding `addCustomItem` call sites in `Step7Categories.tsx`. New items created from the Dashboard quick-add or the Custom Item detail page can set description; items created in onboarding start with no description and the user can add it later.
- **C2 immutable auto-set**: happens in `ItemDetail.tsx` via `useEffect` on first open — not in the store. If an item needs to be auto-set before the detail page is visited, that's a future refinement.

**Previous phase (old-numbering 13 — First Impressions Review):** Reviewed dogfooding notes from session 2 (33 distinct items). Categorized into bugs (A1–A6), copy/UX (B1–B6), missing features (C1–C12), and defer-to-v2 (D1–D6). Identified 9 cross-cutting design decisions (D-1 through D-9 — see "Decisions from Phase 13" section below). Two structural insights drove the bulk of the new work: (1) blockers become first-class structured objects forming a recursive resolution-task graph, with `out_of_control` blockers split into `policy` (KB-tracked, app polls and auto-resurfaces on KB-condition change) and `personal_circumstance` (user re-evaluates manually); (2) `intent` is a separate field from `status` — captures *why* an item is or isn't on the list (`update` / `not_applicable` / `not_wanted` / `unknown`), enabling bulk intent capture in onboarding via grouped/searchable/per-category mark-as flows. Phase map rewritten: existing Phases 12–17 renumbered to 18–23; new Phases 12–17 inserted as the pre-beta fix waves. Blocking-beta list committed below. No code written in that session — that phase was analysis-only by charter.

**Notes for future phases:**

- **Phase 10 carryover — `required_by` field unpopulated in KB snapshot**: All dependency edges are declared only in the requiring item's `requires` array (e.g., `il-dl.requires = ['ssa-name']`). The `required_by` field on KB items is always `[]` in the current snapshot. `UnlocksHint` correctly derives dependents by scanning all items for `requires.includes(slug)` — this is correct and doesn't need the field. If the KB eventually populates `required_by`, the ordering graph's merge logic handles both directions.
- **Phase 10 carryover — open_doors description text**: The KB `description` field is used in the open_doors section cards. All current items have descriptions, but if a future item has a null or empty description the card still renders cleanly (description only shows when truthy).

- **Phase 11 carryover — recovery_items populated in Phase 13**: `il-dl` now has `["ssa-name", "il-birth-cert"]`; `ssa-name` has `["il-birth-cert"]`. Other items still have no `recovery_items` — add as appropriate during future KB content passes.
- **Phase 11 carryover — ICS calendar export not built**: Deferred to v2 (Phase 23). Data model already supports it when prioritized.
- **Phase 11 carryover — "First Sunday of month" recurrence + multi-time-per-day patterns not built**: Calendar-based recurrence and multi-event-per-day (morning/evening doses) deferred to v2.

- **Phase 9 carryover — `transition-kb/` needs its own GitHub repo**: The app fetches from `https://raw.githubusercontent.com/metaphorever/transition-kb/main/`. Until that repo exists the app uses the bundled snapshot — fine for development. Phase 18 (deploy) sets up the repo.
- **Phase 9 carryover — vite.config.ts updated**: Added `server.port` to respect `process.env.PORT` for the Claude preview system. This is a dev-only change; does not affect build.
- **Scoping decision — transition timeline / photo management is out of scope for v1**: The Companion is not a photo journal or timeline app. The in-scope version is: a recurring item (fixed or manual mode) reminding the user to take progress photos on their own schedule, plus a reference note pointing to where they store them (local folder, private cloud, etc.). The app never stores, displays, or manages photos. A full timeline feature — with image storage, comparison views, date-stamped gallery — is explicitly deferred and belongs in a separate product or a future major version, not as a feature of this app.
- **Future design — health/transition logging as a separate companion system (v2)**: Logging weight, body measurements, hormone levels, mood, and similar data is genuinely useful and connects naturally to the Companion's context — but it is not a bolt-on feature of this app. The right architecture is a separate system with its own privacy model (the data is more sensitive than a checklist; it should have independent access controls, never be bundled with the checklist export by default, and ideally run in a separate storage namespace). That system should work *with* the Companion rather than inside it — meaning: the Companion can surface prompts or links to the logging system when relevant (e.g. "you may want to log your levels before this appointment"), but the logging system's data and UI live separately. Before building: decide whether this is a second browser app sharing localStorage keys under a common namespace, a separate URL with a shared data bridge, or something else entirely. The privacy model has to be designed first, not retrofitted.

- **Future design — jurisdiction model gaps**: The current KB handles federal → state (federal item as base, `Jurisdiction` file adds overrides). Two gaps to resolve before the contribution model gets more structured: (1) **City/local**: no `subregion` field exists — a note scoped to a specific DMV location has nowhere to live in the schema. (2) **Cross-state experience provenance**: `last_verified` is a single string; there's no model for "verified working in CA, IL, TX by multiple contributors." These are distinct from authoritative process data and probably need a separate annotation layer. Resolve before building structured contribution submissions.
- **Future design — pronouns model and UI**: Current model stores a single string on `profile.pronouns`. Needs to support: multiple pronoun sets (not radio — multi-select + infinite custom add); priority ordering within the set; preference behavior (consistent use of one vs. rotation vs. other — exact phrasing TBD); and user-defined context criteria attached per pronoun entry (free-text labels the user writes, e.g. "when I'm feeling fem," "with close friends," "formal situations"). Context criteria are not system-interpreted — they're human-readable notes about when a pronoun applies, stored as strings, surfaced to anyone the user shares this information with. The schema direction is `pronouns: PronounEntry[]` where each entry has `{ text: string; priority: number; contexts: string[]; any_pronouns?: boolean }` plus a top-level `pronoun_exclusions: string[]` and `pronoun_preference: 'consistent' | 'varied' | string`. Also need an "any pronouns" flag and "any except [exclusions]" mode. Affects onboarding Step 2, Settings profile section, and anywhere pronouns are displayed. Design the storage shape before building.
- **Future design — names model and plural-system awareness**: Current model assumes one name: `display_name` / `chosen_name` as a single string pair. Needs to support multiple names with context labels (e.g., "name with family," "name at work," "legal name," "everyday name") — user specifies what name applies when. Schema direction: `names: NameEntry[]` where each entry has `{ text: string; contexts: string[]; is_legal?: boolean }`, replacing the current single-string fields. Separate concern: the app should not be actively hostile to plural systems. "Not hostile" means: don't hard-code "you" as singular throughout copy, allow multiple names without judgment or a cap, don't assume the same person is always at the keyboard in a session. Full plural support (per-member profiles, fronting state, system-level vs member-level safety) is explicitly out of scope for v1 — but architecture and copy should not preclude it later. The name model above is compatible with plural use without requiring it. Review all copy that addresses the user directly ("your checklist," greetings) for implicit singular assumptions.
- **Phase 7 carryover — `items_they_need_to_update` are free-text strings**: Stored as `string[]` on the `Person` record. If Phase 10 wants to link them to actual KB item slugs, that's a data migration + schema change.
- **Phase 6 carryover — `document` type not user-addable in UI**: Stored document blockers are ignored by `isActiveStoredBlocker` (graph is source of truth). The UI correctly exposes only the 7 user-defined types. No change needed unless the design evolves.
- **Phase 5 carryover — custom items have no detail page**: Phase 10 pass should add this.
- **Phase 5 carryover — legal advice note per-view**: Phase 10 can add session tracking.
- **Phase 2 carryover — status semantics**: `complete` and `at_risk` satisfy a document dependency; `revoked` does not. See `SATISFYING_STATUSES` in [src/utils/ordering.ts](src/utils/ordering.ts).

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

### Phase 11 — Recurring Items, Sub-tasks, and Recovery Paths
**Model: Sonnet · Effort: high**

- `RecurringItem` type (fixed/manual/open modes) in UserData, separate from KB and custom items
- `SubTask[]` on `ChecklistEntry` — user-created steps, distinct from read-only KB process steps
- `recovery_items?: string[]` on `KBItem` — forward-path items surfaced when status is at_risk or revoked
- Dashboard: overdue/due-today recurring items at top; open intentions in soft section; track-filtered
- Past-due sub-tasks surface as a quiet flag on item cards in the dashboard
- `/recurring` route with full add/edit/remove/log management UI

### Phase 12 — Wave 1: Bugs + Intent Field + Custom Items First-Class + Immutable Handling
**Model: Sonnet · Effort: high**

Foundational schema and bug-fix wave. Lands the data-model changes downstream waves depend on.

Schema changes:
- Add `intent` field to `ChecklistEntry`: `'update' | 'not_applicable' | 'not_wanted' | 'unknown'`. Default `'update'` for existing entries. Dashboard active list filters by `intent === 'update'`. Items the user has never interacted with don't get a ChecklistEntry — silence isn't a choice.
- Add `policy_blocked` to status enum.
- Add `researching` to status enum.
- Custom items: extend ChecklistEntry shape so custom items support description, user-authored process steps, sub-tasks (already present), notes, full edit/delete.

Custom items first-class (C1):
- Detail page for custom items, shared component with KB items (KB-specific fields hidden when absent).
- Edit, delete with confirmation, full status + intent controls.
- Sub-tasks and blockers attachable to custom items.

Immutable handling (C2):
- KB items with `immutable: true` auto-set status to `policy_blocked` on first interaction (final naming during implementation).
- Immutable items don't appear in active list. Live in a "currently not possible / informational" section grouped with other `policy_blocked` items.

Recurring start-on date (C4):
- `RecurringItem` gains optional `start_date?: string`. Due-date arithmetic uses `start_date` as the anchor when present, else `last_logged_at`. Enables alternating-Thursday injection schedules and similar staggering.

Dated one-shot tasks (C5):
- `ChecklistEntry` gains optional `due_date?: string` (deadline) and `event_date?: string` (scheduled appointment) — distinct fields.
- Dashboard surfaces dated items by proximity using the same display logic as recurring.
- On completion of a dated event, prompt to convert to recurring if appropriate (initial HRT visit → every 3 months).

Bugs:
- A1 — scroll-to-top on route change (mobile especially)
- A2 — text inputs ≥16px font-size to suppress iOS auto-zoom
- A3 — track-scope warnings (federal marker warning must not show on social/personal tracks)
- A4 — dashboard active list filters by `intent === 'update'`
- A5 — timezone-safe due-date computation in `src/utils/recurring.ts`
- A6 — real page title (replace "tc-scaffold") and favicon

Migration: existing user data with no `intent` field defaults to `update`. No data loss. Test suite must pass before phase is considered complete.

### Phase 13 — Wave 2: Multi-Aspect Item Split + KB Content Refresh
**Model: Sonnet · Effort: high — Opus subsession for alert copy**

Splits federal items where name and gender marker have policy-divergent statuses. Refreshes KB content to match current legal reality.

Item splits (D-1):
- `ssa-name` and `ssa-marker` — independent items, independent statuses, independent blockers.
- `passport-name` and `passport-marker`.
- `passport-card-name` and `passport-card-marker`.
- `fsa-id-name` and `fsa-id-marker` (if marker is independently changeable).
- `irs-marker` (IRS name auto-derives from SSA name — no separate `irs-name`).
- Any other federal item where the two aspects have meaningfully different policy status.

Migration: existing user data with `ssa` checklist entry maps to `ssa-name` (status preserved). `ssa-marker` starts fresh with `intent: 'update'` if user had any progress on the SSA item, else `intent: 'unknown'`. Same pattern for passport, etc.

Dependency graph updates: items that depend on "SSA name change" point to `ssa-name`. Items that depend on a federal marker change point to the relevant `-marker` item.

KB content refresh (B6):
- Federal marker alert copy: rewrite to reflect current near-total ban. No "may be possible with documentation" hedging. Plain about what's happening. Pair with `policy_blocked` defaults on affected items.
- Verify `last_verified` dates and policy claims on every federal item.
- Add `recovery_items` to items that have them (carryover from Phase 11): `il-dl`, `ssa-name` (and possibly `ssa-marker`), others as relevant.

Alert copy work is an Opus subsession. Same tone constraints as Phase 5 alert copy.

### Phase 14 — Wave 3: Onboarding Overhaul (Document State + Jurisdiction + Bulk Intent UI)
**Model: Opus · Effort: high**

Onboarding becomes the place where users capture three layers of context: who they are, what jurisdictions matter, and what their current document state is. The grouped/searchable/bulk-mark item picker pattern replaces any flat "do you want to track X?" steps.

Onboarding additions (D-3, D-4, D-9):
- **Birth jurisdiction step**: separate from current residence. Asked early in jurisdiction sequence.
- **Other relevant jurisdictions step**: "do you have important documents from anywhere else?" — supports prior residences, immigration history. Always optional.
- **Document state capture**: for major federal/state ID, capture current state — `{ name_status, marker_status, issued, expiration_date? }`. Asked per-item with skip-and-decide-later option.
- **Bulk intent picker**: grouped (category headers), searchable (filter as you type), per-category mark-all-as (`not_applicable` / `not_wanted` / `update` / `unknown`), per-item quick-mark buttons. Default: items not touched aren't added to the checklist.

Schema additions:
- `Profile` gains `birth_jurisdiction?: Jurisdiction` and `other_jurisdictions?: Jurisdiction[]`.
- `ChecklistEntry` gains optional `jurisdiction_override?: Jurisdiction`.
- `ChecklistEntry` gains optional `document_state?: { name_status, marker_status, issued, expiration_date? }` for items where applicable.

Item rendering branches based on `document_state` when present — pre/post-transition flow shows the right process for the user's actual starting state.

Settings inherits the same bulk-mark UI for post-onboarding intent changes.

Opus required because the onboarding copy must handle skip paths gracefully, never imply that capturing any of this is mandatory, and never make the user feel surveilled.

### Phase 15 — Wave 4: Blocker Model Rework
**Model: Opus · Effort: high**

The structural one. Blockers become first-class structured objects forming a graph; dashboard reshapes around the new model.

Schema (D-7a/b/c):
```
type Blocker = {
  id: string;
  type: BlockerType;
  resolution_mode: 'resolvable' | 'out_of_control';
  out_of_control_kind?: 'policy' | 'personal_circumstance';
  resolution_task_ids?: string[];      // when resolvable
  kb_condition_ref?: string;            // when out_of_control_kind === 'policy'
  description?: string;
  status: 'active' | 'resolved' | 'manually_dismissed';
  status_date: string;
  suppress_workaround?: boolean;
};
```

KB additions:
- New `conditions` namespace in KB (e.g., `federal-marker-policy`, `us-passport-issuance-policy`). Each tracks current state with `status_date`. When the KB updates a condition (someone watching the news submits a PR), affected users see a "policy on this has changed since you marked it blocked — want to revisit?" prompt.
- Items reference conditions in their alerts via `kb_condition_ref`.

Dashboard reshape:
- **Active** — tasks with no active blockers, ready to work on.
- **Working on blockers** — tasks with only `resolvable` active blockers. Resolution tasks expand inline.
- **Waiting** — tasks with any `out_of_control` blocker, plus immutable items, plus `policy_blocked` items. Collapsible. Quiet — doesn't pester.

Item detail blocker section rewrite:
- Each blocker shows: type, resolution mode, description, and (when resolvable) linked resolution tasks expandable inline.
- "Drill into" a resolution task with breadcrumb navigation back to the parent — critical for chains 4+ deep.
- One-click "convert this blocker into a task" creates a custom resolution task pre-linked to the blocker.
- For `out_of_control` `policy` blockers: status line tied to the KB condition. When condition changes, non-anxious "want to revisit this?" prompt on the parent task.
- For `out_of_control` `personal_circumstance` blockers: optional "remind me to re-check in N months" recurring item.

Resolution does not cascade. Completing a resolution task surfaces a one-click "this blocker can now be resolved" prompt on the parent. User confirms. Preserves the "having the key doesn't mean the door is open" principle.

Migration: existing user-defined blockers default to `resolution_mode: 'resolvable'` with no resolution tasks. User can reclassify in item detail or Settings.

This phase touches schema, KB schema, dashboard, item detail, and every flow that displays blockers.

### Phase 16 — Wave 5: Item Detail UX + People Map Expansion + Name-Finding Flow + Social Name Change
**Model: Sonnet · Effort: high — Opus for new copy and the name-finding task content**

UX cluster plus the people-map and name-related work that uses the new blocker model from Phase 15.

Item detail UX (B1–B5, D-8):
- Reorder hierarchy: title → status + intent → blockers (collapsed if empty, "no blockers found, expand to add" copy) → sub-tasks → walkthrough/details (collapsed by default, per-user preference for default-expand) → user notes.
- Edit/remove on people and blocker cards: separated visually, confirmation copy that distinguishes "this is bad data" from "the situation changed" (steers toward status change for the latter).
- Safety menu dedup: remove "unsure"/"not sure" redundancy (B4).
- After-completion: quiet visual acknowledgment, suggested next step (back-to-dashboard quick-link), prompt for notes. No fireworks.

People map (C11):
- `out_to` expanded: `not_now_not_ever` | `not_yet` | `partially` | `completely`.
- "How did it go?" surfaces only when user is out to the person.
- "Things they need to update" hidden by default for not-out or unsupportive people.
- When user adds a "needs update" item for a not-out or unsupportive person, the resulting task is auto-blocked with a "come out to X" blocker using the new blocker model. This is the canonical demonstration of D-7a/b.
- Derived view: "who can know what" — filtered list for sharing with allies. Generated, not stored.

Name-finding flow (C8, C9):
- New KB item: `social-name-change` — distinct from legal name change. Lives in social track.
- New KB item: `find-a-name` — aspirational starter task. Sub-tasks: "decide cultural feel (masculine/feminine/unisex/nonbinary)" / "ask parents about names they considered before" / "honor a family member?" / "try it on in private" / "try it on online" / "try it on with a trusted ally."
- Onboarding name step: "I don't know yet / start from zero" path adds `find-a-name` to the user's checklist.
- `find-a-name` can be a blocker resolution for `social-name-change`, which can be a blocker resolution for `ssa-name`. Demonstrates the recursive blocker chain end-to-end.

Opus subsessions: completion-moment copy, name-finding task content, people-map empty/skip states.

### Phase 17 — Wave 6: Contribution Surfacing + Completion-Moment Hooks
**Model: Sonnet · Effort: medium**

Closes the gap between "user set contributor dial to max" and "user actually gets prompted."

Verify state first:
- Confirm whether Phase 9 shipped contribute-level surfacing logic at all. Read code, don't assume. Root-cause before fixing.

Surfacing logic (C12):
- On task completion: prompt for personal notes (private). Separately, prompt for contribution back to KB (process knowledge only — personal notes never included). Frequency tied to contributor dial.
- On encountering a KB item the user knows more about: surface "want to contribute to this item?" — frequency tied to dial.
- New contributor walkthrough: if user set max involvement, walk them through how to actually submit a GitHub issue / PR. One-time, dismissible.
- `unknown` intent items: surface gently under `walk_with_me` presence OR when contributor dials indicate openness to nudges (D-9). Never under `just_the_path` without that signal.

Completion-moment hook (B5):
- Quiet visual change when status flips to `complete`.
- "Back to dashboard" quick-link, no scroll required.
- Prompt for any new knowledge gained during the task.

### Phase 18 — Deploy and Dogfood
**Model: Sonnet · Effort: medium**

*This is a technical phase followed by a sustained personal use period before Phase 19 begins.*

**Deployment note (2026-05-11):** The subdomain was accidentally deleted and recreated. The `.htaccess` config required non-obvious settings to work correctly (had trouble with it previously). When Phase 18 begins, recovering the working `.htaccess` setup is the first priority — check git history and any notes for the config that was confirmed working. Do not assume a default Apache/cPanel config will handle Vite's client-side routing correctly without it.

Technical work:
- Deploy the app to your website (static hosting, Vite build output)
- Restore and document the working `.htaccess` (SPA routing rewrite rules — was tricky last time)
- Set up any CI/CD needed for future deploys (GitHub Actions or equivalent)
- Confirm the app loads correctly on mobile (responsive check, no broken layouts)
- Confirm localStorage behaves correctly across browsers you actually use
- Set up the `transition-kb` GitHub repo so the live app fetches from it instead of the bundled snapshot

Dogfooding period (no Claude Code session needed):
- Enter your own real data — checklist items, blockers, people, recurring items
- Use the app daily for at least 2–3 weeks before moving to Phase 19
- Keep a running note (a simple text file, not in the app) of friction points, missing things, things that feel wrong, and things that work well
- The goal is first-person evidence, not a feature wish list

*The first attempt at the dogfood window (May 2026) was thin — basic correctness issues hit before daily use was viable. Phases 18B, 18C, and 18D below are the unblocking sprint. The real dogfood window happens after they ship.*

### Phase 18B — Display/Correctness Fixes
**Model: Sonnet · Effort: medium**

Pre-dogfood fix sprint surfaced by the brief Phase 18 dogfood window. All UI / data-correctness; no architectural decisions.

- **B18-1 — Birth-jurisdiction-scoped items + stub spawning.** Add `jurisdiction_scope: 'residence' | 'birth'` to KB item schema (default `'residence'`). Birth certificate items declare `'birth'`. Filter logic reads `profile.birth_jurisdiction` when scope is `'birth'`, else `profile.jurisdiction`. `ChecklistEntry.jurisdiction_override` takes precedence over both. When no KB item exists for the user's birth jurisdiction (unmodeled state/country), spawn a stub custom item with `provenance: 'jurisdiction_stub'` and new optional field `jurisdiction_stub_for?: { kb_slug: string; jurisdiction: Jurisdiction }`. Mirrors Phase 14's `aspiration_skeleton`. Placeholder description: "No birth certificate item exists for [jurisdiction] yet. Fill in steps and resources here as you find them." Contribution nudge appears only after edits AND only when contributor settings opt in — never on creation.

- **B18-2 — Step 8 bulk intent card layout.** CSS-only fix in `BulkIntentEditor`. Description text fills available horizontal width; mark-as controls sit alongside or below description, not in a narrow column. Verify desktop + mobile.

- **B18-3 — Policy-blocked visual treatment + intent copy.** UI/copy only; no schema change. Distinct status chip styling for `status === 'policy_blocked'` (clearly "currently not possible", not "actionable"). Intent selector renders the existing `update` value with a contextual label "Update when possible" when status is `policy_blocked`. Same enum value stored. Apply across item detail and bulk intent picker.

- **B18-4 — Step 10 review uses real titles for custom items.** Find the renderer (`Step10Summary` or equivalent); render `item.label` / `item.description` instead of `item.id`. Single grep for `Custom-` or item-id rendering should surface any other callsites with the same fallback (item detail header, dashboard cards). Fix all in one pass.

- **B18-5 — Dashboard "waiting on [X]" overflow.** Title (top) + blocker label (below), stacked, not in columns. Blocker label wraps; muted color/smaller font. Verify across Active / Working on blockers / Waiting / Currently not possible sections.

- **B18-6 (parts 1 + 2) — DocumentState aspect-correct labels + `never_expires`.** Picker labels reflect entry `kind`: `'name'` shows "Name status" only with the four `DocFieldStatus` options; `'marker'` shows "Marker status" only; `'full'` shows both, each with the four options. New optional KB field `never_expires?: boolean`; when true, the document state UI hides the `expiration_date` picker. Audit and set on birth certificates, SSA card, marriage certificate. Migration is a no-op (existing `expiration_date` values stay in storage and become available again if the flag flips). Part 3 (unification) is Phase 18D.

### Phase 18C — KB Dependency Map
**Model: Sonnet · Effort: medium**

Generator → canonical → validator cycle. Lets the developer hold the dependency graph in mind as the KB grows.

- **Generator** (`scripts/generate_dependency_map.py`) — reads `transition-kb/items/*.json`, emits `transition-kb/_dependency-map.generated.mmd`. Per-track subgraphs (Mermaid `subgraph` blocks). Edges derived from `requires`. Hard edges as solid arrows (`-->`).

- **Canonical hand-edited map** (`transition-kb/_dependency-map.mmd`) — bootstrap by copying the generated file; then edit by hand to add soft relationships, rearrange, annotate. This is the developer's working model.

- **Validator** (`scripts/validate_dependency_map.py`) — reads both files, reports drift in three buckets: in JSON missing from canonical / in canonical missing from JSON (only checks hard `-->` edges; soft `-.->` edges are design-only and never reported as drift) / edges differ. Output is a report, never a build failure.

- **npm wiring** — generator runs as a pre-build step in `package.json`. Validator runs on demand (`npm run validate-deps` and shell). Underscore prefix on `.mmd` filenames signals "meta-file, not a KB item."

- **Soft edges stay in Mermaid only.** They are *not* encoded into KB JSON `requires`. The runtime dependency graph only obeys hard relationships. A future surfacing layer (walk_with_me suggestions consuming soft edges as hints) is plausible but explicitly out of scope for 18C.

### Phase 18D — Document State Unification
**Model: Sonnet · Effort: high**

B18-6 part 3. Architectural choice: how should split federal items (e.g. `ssa-name` + `ssa-marker`) present as a single physical-document entry on the document-state UI while remaining separate checklist entries?

Pick at session start:
- **(a)** Add `physical_document_id?: string` to KB items. UI coalesces entries with the same `physical_document_id` into a single row. Storage stays per-`ChecklistEntry`. Smaller schema change.
- **(b)** Move `DocumentState` out of `ChecklistEntry` into a separate `Profile.documents` collection keyed by physical document. `ChecklistEntry` references back if needed. Cleaner separation; bigger migration.

Decide before implementing. Affects Settings `DocumentStateSection`, onboarding Step 4 (per-item document state capture), and anywhere `ChecklistEntry.document_state` is read.

### Phase 19 — Second Dogfood Review
**Model: Opus · Effort: high**

*Same shape as Phase 13. Planning and analysis only — no code merged.*

*A spec-only triage pass against the brief Phase 18 dogfood window happened on 2026-05-14 and produced Phases 18B / 18C / 18D plus this charter update. The full Phase 19 review — against real daily-use data — still needs to run after those three phases ship and a 2–3 week dogfood window has actually happened.*

- Review the notes collected during the real (post-18B/C/D) dogfooding period
- Categorize: (a) bugs, (b) copy/UX friction, (c) missing features that genuinely block beta, (d) defer
- Update CLAUDE.md with any new fix phases needed before Phase 21
- Update the blocking-beta list with anything new that surfaced from real use
- Decide where the pronouns/names model expansion lands in the pre-beta sequence (currently slated for "before Phase 21" with no firm phase number)

### Phase 20 — MVP to Public Beta Roadmap
**Model: Opus · Effort: high**

*Planning session only. No code is written.*

- Take the output of Phase 19 and write a specific, sequenced roadmap from current state to public beta
- Define what "public beta" means: what must be true, what can be rough, what is explicitly out of scope
- Identify anything that changes the app's posture for public use vs. personal use: privacy copy, data handling notice, "this app stores nothing on our servers" statement, any legal/safety language that needs review
- Decide on beta access model: open link, invite-only, soft launch
- Update CLAUDE.md with the agreed scope and sequence

### Phase 21 — Open Public Beta
**Model: Sonnet (for code fixes) · Effort: varies**

*The phase begins with the beta launch and stays open until the beta closes. Sessions during this phase are fix-and-polish sprints driven by Phase 19/20 findings, not feature development.*

- Execute the specific changes identified in Phase 20
- No new features during beta unless they directly unblock beta users
- Each session should be scoped to a single, well-defined fix or improvement
- Monitor for any data safety, privacy, or accessibility issues and treat those as blocking
- Keep a running log of beta feedback (separate from CLAUDE.md — a living doc or issue tracker)

### Phase 22 — Beta Feedback to v1.0 Roadmap
**Model: Opus · Effort: high**

*Planning session only. No code. Output is a committed roadmap for v1.0.*

- Synthesize beta feedback into themes: what consistently confused people, what was missing, what worked
- Distinguish between feedback that reflects personal use cases vs. feedback that reflects the app's core purpose
- Make explicit decisions about what goes into v1.0 vs. what gets deferred to v2
- Write the v1.0 definition: what is in, what is not, what "done" means
- Update CLAUDE.md with the v1.0 scope

### Phase 23 — v2 and Beyond (placeholder)
**Model: TBD**

*Not planned in detail yet. Decisions from Phase 22 will define what actually belongs here.*

Known candidates (from earlier design conversations and the Phase 13 review):
- Health and transition logging system (separate app, shared privacy model — see backlog note)
- Plural system awareness (see names/pronouns design notes)
- "How I like to be referred to" rider — honorifics, relational terms, conditional pronoun marking (D2)
- Photo management / timeline (scoped version only — recurring reminder + storage reference, not a photo app)
- ICS calendar export for recurring items
- Multi-time-per-day recurring (morning/evening doses) and calendar-based recurrence (first-Sunday-of-month, etc.)
- Dark mode + OS preference detection (D1)
- Per-reminder surfacing window (day-of / day-before / week-before) (D4)
- Onboarding priority/ranking capture (D3)
- User-story-driven automated test suite (D6 — ongoing practice rather than feature)
- Expanded KB coverage (more states, more item types)
- Contribution pipeline maturation (structured submissions, community verification)
- Quick-exit / privacy mode (flagged as must-not-preclude in v1 architecture)

---

## Decisions from Phase 13

These are *decided*, not open. They came out of the Phase 13 review and apply across the Phase 12–17 implementing waves. The implementing phases reference these by ID rather than re-litigating.

**D-1. Multi-aspect items split, not nested.** Federal items where name and gender marker have divergent policy status (SSA, passport, passport card, FSA ID, IRS marker) become separate KB items with independent statuses and blockers. Cleaner data model, cleaner dependency graph, cleaner UI. Implemented in Phase 13.

**D-2. `policy_blocked` status added.** New ChecklistEntry status for items the user wants but can't currently get due to policy. Distinct from `not_applicable` intent (doesn't apply), `not_wanted` intent (chosen to skip), and `revoked` status (had it, lost it). Tucks the item into the "waiting" section, suppresses repeated warnings, resurfaces if the linked KB condition changes. Implemented in Phase 12 (status enum) and Phase 15 (KB condition tracking).

**D-3. Document state vector.** Per-item, captures current document state separately from the to-do checklist: `{ name_status, marker_status, issued, expiration_date? }`. Drives flow branching — a passport with new-name-old-marker has a different displayed flow than no-passport-yet. Captured in onboarding (skippable) and editable in Settings. Implemented in Phase 14.

**D-4. Jurisdiction-per-item override.** `ChecklistEntry` has optional `jurisdiction_override`. Onboarding captures `birth_jurisdiction` and `other_jurisdictions`; items default to the right one based on type (birth cert → birth jurisdiction; current ID → residence), always overridable. Implemented in Phase 14.

**D-5. Custom items as first-class.** Full detail page, sub-tasks, blockers, intent + status, notes, edit, delete (with confirmation). Shared detail-page component with KB items; KB-specific fields hidden when absent. Implemented in Phase 12.

**D-6. Dated one-shot tasks.** `ChecklistEntry` gains optional `due_date?` (deadline) and `event_date?` (scheduled appointment) — distinct fields. On completion, optional convert-to-recurring prompt for follow-up patterns (initial HRT visit → every 3 months). Implemented in Phase 12.

**D-7a. Blockers are structured first-class objects.** Each has `resolution_mode: 'resolvable' | 'out_of_control'`. Resolvable blockers reference one or more `resolution_task_ids` (KB or custom checklist entries). Resolution doesn't cascade — completing a resolution task surfaces a one-click confirm-resolve prompt on the parent. Preserves the "having the key doesn't mean the door is open" principle. Implemented in Phase 15.

**D-7b. Blocker chains form a graph and recursion is supported.** A resolution task is itself a task; it can have its own blockers, which can have their own resolution tasks, etc. Depth is arbitrary. A single resolution task can be referenced by blockers on multiple parent tasks (e.g. "come out to parents" is the resolution for blockers on several other tasks). UI uses breadcrumb navigation when drilling into nested blockers — critical for chains 4+ deep. Implemented in Phase 15.

**D-7c. Out-of-control blockers split by kind.** `out_of_control_kind: 'policy' | 'personal_circumstance'`.
- `policy` blockers reference a KB `condition` (e.g., `federal-marker-policy`) via `kb_condition_ref`. The app polls KB conditions; when a condition's `status_date` advances and status changes, affected users get a non-anxious "want to revisit this?" prompt. The KB is the source of truth — someone watching the news submits a PR; the app surfaces the change.
- `personal_circumstance` blockers don't auto-poll — only the user knows when their parents come around. User can optionally attach a recurring "remind me to re-check in N months" reminder.
Implemented in Phase 15.

**D-8. Task detail UI hierarchy.** Order: title → status + intent → blockers (collapsed if none, with "no blockers found, expand to add" copy) → sub-tasks → walkthrough/details (collapsed by default, per-user preference for default-expand) → user notes. `researching` status added. Implemented in Phase 12 (status enum) and Phase 16 (UI reorder).

**D-9. Intent is separate from status.** `ChecklistEntry` gains an `intent` field: `'update' | 'not_applicable' | 'not_wanted' | 'unknown'`. Dashboard active list filters by `intent === 'update'`. Items the user has never interacted with don't get a ChecklistEntry — silence isn't a choice. `unknown` items surface only under `walk_with_me` presence OR when the contributor/involvement dials indicate openness to nudges — never silently at `just_the_path`. Bulk intent capture in onboarding via grouped/searchable/per-category mark-as flows. Implemented in Phase 12 (schema, basic UI), Phase 14 (onboarding bulk picker), Phase 17 (nudge surfacing).

---

## Blocking-beta list

Every item below must be addressed before public beta (Phase 21) opens. Pulled from the Phase 13 review. Phase 19 may add more after a second round of dogfooding.

**Bugs** (Phase 12 unless noted):
- A1 — Mobile scroll-to-top on route change
- A2 — iOS text-box zoom suppression (≥16px inputs)
- A3 — Track-scope warnings (no federal marker warning on social/personal tracks)
- A4 — Dashboard filter excludes `intent !== 'update'`
- A5 — Timezone-safe recurring due-date math
- A6 — Page title and favicon (Phase 12 sets values; Phase 18 verifies in production)

**Schema/model changes** — all of D-1 through D-9 are blocking.

**Copy/UX:**
- B1 — Empty-state blockers copy (Phase 16)
- B2 — Item detail page hierarchy (Phase 16, per D-8)
- B3 — Edit/remove proximity + remove confirmation copy (Phase 16)
- B4 — Safety menu dedup (Phase 16)
- B5 — Completion acknowledgment + contribution prompt (Phase 17)
- B6 — Federal marker warning copy accuracy (Phase 13)

**Missing features:**
- C1 — Custom items first-class (Phase 12)
- C2 — Immutable items off the active list (Phase 12)
- C3 — Multi-aspect items split (Phase 13)
- C4 — Recurring `start_date` (Phase 12)
- C5 — Dated one-shot tasks (Phase 12)
- C6 — Document state model (Phase 14)
- C7 — Per-item jurisdiction + onboarding capture (Phase 14)
- C8 — Social name change as distinct KB item (Phase 16)
- C9 — Find-a-name task + onboarding "don't know yet" path (Phase 16)
- C10 — Blocker model rework with resolution-task linkage (Phase 15)
- C11 — People map expansion (Phase 16)
- C12 — Contribute-level surfacing verified and working (Phase 17)

**Bugs and design artifacts from Phase 18 dogfood (2026-05-14 triage):**
- B18-1 — Birth-jurisdiction filter + stub spawning for unmodeled jurisdictions (Phase 18B)
- B18-2 — Step 8 bulk intent card layout (Phase 18B)
- B18-3 — Policy-blocked visual treatment + "Update when possible" intent copy (Phase 18B)
- B18-4 — Step 10 review uses real titles for custom items (Phase 18B)
- B18-5 — Dashboard "waiting on [X]" overflow (Phase 18B)
- B18-6 — DocumentState aspect-correct labels + `never_expires` flag (parts 1+2 in Phase 18B; part 3 — physical-document unification — in Phase 18D)
- D18-1 — Generated + canonical + validated KB dependency map (Phase 18C)

**Pre-beta-tester (not personal-dogfood) blockers:**
- D2 — Pronouns/names model expansion: multiple names with context labels; multi-pronoun sets with priority + per-context labels; "any pronouns" / "any except" flags; plural-system not-hostile copy review. Phase TBD; slotted after Phase 19 / before Phase 21. (Moved from v2 — not personal-dogfood-blocking, but real once external testers come through with multi-name / multi-pronoun / plural-system contexts.)

**Explicitly deferred to v2 (Phase 23), not blocking beta:**
- D1 — Dark mode + OS preference detection [OPEN: re-evaluate as beta-blocking before Phase 20 — accessibility/eye-strain in stressful contexts]
- D3 — Onboarding priority/ranking capture
- D4 — Per-reminder surfacing window (day-of / day-before / week-before)
- D5 — Multi-time-per-day recurring + calendar-based recurrence patterns
- D6 — User-story-driven test suite (ongoing practice, not a feature)
- Quick-exit / privacy mode [OPEN: re-evaluate as beta-tester safety blocker before Phase 20 — shared-device / surveillance contexts]

---

## Language constraints (enforced throughout)

These apply to every string in the app, including error messages. When in doubt, check the design doc's "Tone in Copy" and "Alert Messaging Guidelines" sections.

- Never use the phrase "easy wins" anywhere
- Never say "unfortunately" or "we're sorry"
- Never perform sympathy — the app is steady, not grieving
- No emoji anywhere in UI, copy, components, or KB files
- No motivational micro-copy that feels performative
- Error messages: plain language, say whether data is safe, offer a next step, no HTTP codes or stack traces

### Privacy posture and first-person voice

The app has no relationship with the user's data. It is a tool, not a service, not a companion with feelings, and not an entity the user is communicating with. Data is recorded locally for the user's own reference — it is not shared with, reported to, or interpreted by anyone.

**There is no "we" or "us" in this app.** The parties that exist are:
- The user (second person: "you", "your")
- The user's personal social graph (people they are or are not out to)
- The community (contributors to the KB — an impersonal third party, not a relationship)

Consequences for copy:
- "Tell us" → "Record" or drop entirely
- "Help us show you" → "Determines" or "Used to show"
- "What you've told us" → "Your location and document status" (be specific about what data is actually used)
- "We need" → rewrite to remove the agent entirely
- Onboarding prompts collect data the user is recording for themselves, not submitting to anyone
- Contribution prompts are explicit that sharing is optional, one-directional, and anonymized at the process level — personal notes are never included

When reviewing any new copy, ask: is there an implied "us" receiving this information? If yes, rewrite.

---

## Content philosophy (KB items, conditions, alerts, item descriptions)

These rules govern what goes into KB content files (item descriptions, process steps, status notes, condition `status_summary`, alert copy). They are separate from the language/tone constraints above — those say *how* to phrase things, this says *what* to put in.

**Authoritative reference > broad steps > full summary.** The Companion's job is to map terrain and point at the source of truth. It is not a legal encyclopedia, a policy newsletter, or a process documentation site. Those exist; link to them.

When writing or editing KB content:

- **Find the authoritative reference and link to it.** BoA's name-change help page, the USPS form page, the federal court order tracker at Lambda Legal, the state DMV's appointment booker. These are the substance.
- **List broad/skeletal steps, not full process detail.** "Submit by mail or in person — find a location" beats summarizing the eight-step instructions on the source page. Steps should orient, not replicate.
- **Status summaries on conditions should be one or two sentences of factual orientation, then defer to `references`.** The Phase 15 Stage C rewrites of `federal-marker-policy` and `us-marriage-policy` are the canonical examples. Don't reach for paragraph-length policy explanations even when the topic is heavy — the references carry it.
- **No promises about timelines, eligibility, or outcomes the app can't verify.** Defer to the authoritative source for anything the user will act on.

Why: keeps the DB small, keeps content fresh by deferring to a source we don't have to maintain, makes contribution easy (link + sketch is something a layperson can submit), and avoids the app misstating something high-stakes because a contributor's summary went out of date six months ago.

**Existing KB content does not yet uniformly follow this pattern.** Several item files still summarize process steps at length. This is incremental cleanup, not a single content pass — when a content phase touches an item, conform it to this standard.

**Encoding hygiene for KB content files**: write em-dashes as `—` (U+2014), en-dashes as `–` (U+2013), curly quotes as `"` `"` `'` `'` directly in UTF-8. Do not paste from cp1252/Windows-1252-encoded sources without verifying. The `public/kb-snapshot/index.json` build process must read source as UTF-8 and write either real UTF-8 or correct `\uXXXX` JSON escapes — never `â€”` and similar mojibake (cp1252 reinterpretation of UTF-8 punctuation byte sequences). See `scripts/audit_mojibake.py` and `scripts/fix_mojibake.py` for a defensive check and a one-shot repair if the snapshot regresses.

---

## Open design questions (resolve before building the affected phase)

- **Dependency graph: computed, and completion does not cascade** (decided): The dependency graph is a pure computed function. On each load, it reads current checklist statuses + KB `requires` fields and derives which items are currently blocked by missing documents. Document blockers are never stored as records — they are always derived. User-defined blockers (relationship, safety, readiness, waiting, custom) remain stored records because only the user can resolve them.

  Critically: completing a required item makes dependent items *available*, not *complete*. SSA complete → driver's license moves from "unavailable" to "available now" on the dashboard. The driver's license status remains `not_started` (or whatever the user last set it to) until the user explicitly completes it. The app never changes an item's status automatically based on another item's completion. Having the key does not open the door — it means the door can now be opened. What happens next involves steps the user has to take, and may involve other blockers (safety, relationship, readiness) that exist independently of the document dependency. Do not implement any cascade or auto-complete behavior.

- **Quick-exit / privacy mode** (noted out of scope for v1 but architecture must not preclude it — keep in mind during Phase 4 and Phase 9). **Re-evaluate before Phase 20**: is this actually a beta-tester safety blocker rather than a v2 candidate? Real question — are users likely to be in shared-device or surveillance situations where a panic-close button matters? Not personal-dogfood-blocking. Decision affects whether it gets a phase number before Phase 21.

- **Dark mode + OS preference detection (D1)** — currently sits in v2. **Re-evaluate before Phase 20**: is this beta-blocking on accessibility/eye-strain grounds for users navigating stressful situations, or genuinely fine as v2 polish? Not personal-dogfood-blocking.

- **Phase 18D — Document state unification approach** (resolve at Phase 18D session start, not before): how should split federal items present as a single physical document on the document-state UI while remaining separate checklist entries? Option (a) `physical_document_id?: string` on KB items + UI coalesces; option (b) move `DocumentState` out of `ChecklistEntry` into a separate `Profile.documents` collection. Decide before implementing — both have downstream effects on Settings, onboarding Step 4, and any reader of `ChecklistEntry.document_state`.

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

1. **Run `npm run build` and `npm test` (or just `npm run build` for content-only phases).** Node + npm are available in the worktree shell. Browser preview verification is good for catching runtime issues, but the type-checker and the test suite catch a different class of bug — Stage C shipped with three TS errors and a failing test that only surfaced when build/tests ran in the next session. Don't skip this step. If something fails, fix it before committing. The CLAUDE.md note about "Node/npm unavailable" that lived across Phase 13/14/15 carryover bullets was stale by Stage C — do not propagate that note forward.
2. Commit all phase work, including the CLAUDE.md update that marks the phase complete and records carryover notes. CLAUDE.md updates go in the same commit as the phase work, not a separate one — that way `git log` tells the full story.
3. Merge (or fast-forward) the worktree branch to `main` and push to `origin/main`. Do not leave phase work sitting only on a feature branch — the next phase will branch from main and miss it.
4. **Standing permission**: the user has authorized end-of-phase commits and fast-forward pushes to `origin/main` without re-asking each time. Use `git push origin <branch>:main` from the worktree to fast-forward main directly. Still surface the proposed commit message and the push target before running so the user can object — just don't block waiting for an explicit yes. Force-push to main is never permitted; if a fast-forward isn't possible, stop and ask.

**At the end of every phase session — final message to the user:**

After the commit and push, always close with:
> "Next session: **[Phase N — Name]** · Model: **[model]** · Effort: **[level]**"

One line. No explanation needed unless something is unusual. This makes it easy for the user to configure the next session before opening it.

**At the start of every phase session — before writing any code:**

1. Confirm model + effort match the current phase (rule #1 above).
2. `git fetch origin && git status` — if the worktree branch is behind main, run `git merge --ff-only origin/main`. If fast-forward fails, stop and reconcile with the user; do not write code on top of a divergent base.
3. Read the "Current Phase" block. The "Last session" line and carryover notes are the bridge from the previous session — trust them, but verify any specific file/symbol they reference still exists before relying on it.

**During the session — run the build at natural breakpoints, not just at the end:**

After each substantive logical chunk of code work (e.g., after the schema + store changes land, again after the new UI component is wired, again before moving to a new subsystem), run `npm run build`. The tsc check inside it is fast and catches drift the dev server's HMR overlooks (notably anything in files Vite doesn't re-load). Run `npm test` whenever you change anything the test suite touches — store actions, utility functions, anything in `src/utils/`. Don't batch the verification to the end; type errors compound, and a Stage-C-shaped mistake (three real type errors discovered only in the next session) is what this rule is preventing.

**Carryover notes — what belongs in CLAUDE.md vs. in code:**

- In CLAUDE.md: decisions, type drift, deferred refactors, architectural caveats the next phase needs to know but couldn't infer from reading the code.
- In code comments: the *why* for non-obvious local choices (already a project default).
- Not in CLAUDE.md: anything `git log` already tells you, or anything the next session can find by reading the file in question.

Keep the carryover list short. If it grows past ~6 bullets per phase, prune the ones that no longer apply.
