# Phase 18 Dogfooding Notes

Started: 2026-05-14
Build: Phase 17 (commit 08a65d5) + Phase 18 copy fixes (commit 15378f6)

---

## Bugs

**B18-1 — Birth jurisdiction not filtering checklist items**
Set birth jurisdiction to California. Illinois Birth Certificate still appears in checklist. Items scoped to birth jurisdiction (birth certs) should filter to the user's birth jurisdiction, not residence. Likely: the jurisdiction filter reads `profile.jurisdiction` (residence) and ignores `profile.birth_jurisdiction` for birth-cert-type items.

**B18-2 — Step 8 (Bulk Intent) card layout: narrow text column**
Item descriptions in the bulk intent picker render in a very narrow column, making each card very tall. Text is stacked into a thin tower. Needs a layout fix so description text fills available horizontal space on the card.

**B18-3 — Policy-blocked items present as actionable in UI**
Federal marker items (ssa-marker, us-passport-marker, us-passport-card-marker) say in their description that changes are prohibited, but the UI chrome around them presents them as normal actionable checklist items. Two gaps:
1. Visual treatment doesn't communicate "not currently possible" — text-only signal is insufficient.
2. Intent framing is wrong: a policy-blocked item's intent should be "what I want to do once this is unblocked" — not an action to take now. The status badge, card styling, and intent selector copy should reflect this.

---

## Design / UX observations

**D18-1 — Dependency graph needs a visual map**
The dependency graph between items is complex enough that no one (including the developer) can hold its full shape in their head. A diagram or flowchart of item dependencies is needed as a design/planning artifact — not necessarily in the app, but as a reference that prevents gaps and contradictions in the graph as KB content grows. Consider a generated Mermaid diagram from the KB data as a build artifact, or a maintained design document.

---

## What is working well

- App loads and routing works correctly after .htaccess fix
- Onboarding flow is coherent end-to-end
- KB bundled snapshot loads correctly with no network dependency
- localStorage persistence is solid
