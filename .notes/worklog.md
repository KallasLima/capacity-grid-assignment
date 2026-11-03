# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

- Updated Vite from 8.2.2 to 8.2.4 for published dev-server security fixes. A local, Git-excluded Compose override replaces both published bindings with 127.0.0.1 while preserving the fixed submission environment. Dependency installation with lifecycle scripts disabled and the TypeScript/production build passed. The effective Compose configuration has one loopback-only mapping per service; containers were not started because the Docker engine was stopped.

- Built the capacity API with roster-page/range scoping and full-week weekday aggregation. Checked the full seed rather than deduplicating equal-looking assignments; Jan 5 golden totals include Dee 45/40 and Eli 20/0. Go validation and PostgreSQL fixture tests pass.
- Implemented a paginated grid and confirmed-save editing. Old range responses are ignored, failed saves preserve drafts, and navigation waits for Save/Cancel. Review caught low contrast and lost editor focus; both were corrected and verified with keyboard/browser interactions.
- Docker Desktop did not forward file-change events to the initial Vite process; enabled polling in the editable Vite configuration. Browser checks cover persisted edits, injected failed saves and loads with recovery, pagination/week navigation, and a 390px mobile view. A two-year view rendered 50 people × 105 weeks locally in about 1.2 seconds; this is one local observation, not a production benchmark. The full organization's data is paged.
- Final checks use the supplied container runtime: Go tests including real transactional PostgreSQL fixtures, 4 frontend behavior tests, and the TypeScript/Vite production build. Private browser scripts and screenshots remain outside the repository.

- A fresh parallel requirements audit independently matched all 5,250 cells in a 50-person, 105-week response against the seed. No acceptance gap or fixed-input/environment change was found.
- Review found an uncertain-write recovery defect: a PATCH could commit before its response was lost, then Cancel left stale numbers. Cancel/Escape after an unsuccessful attempt now clears and reloads the grid, restores the row's focus after recovery, and offers focused Retry if that reconciliation fails. Added delayed-response regression tests and exercised real committed-but-dropped responses plus failures before commit; restored test capacity afterward.
- Review also reproduced a mobile keyboard editor hidden beneath the sticky name column. Responsive scroll padding now keeps the input and Save visible; a narrow-screen cue explains horizontal scrolling. Verified the exact keyboard reproduction at 390px. All 6 frontend behavior tests and the container production build pass; the unchanged backend's Go tests remain green.

- Expanded the manager workflow with literal roster search before pagination and atomic compare-and-set capacity updates. Conflicts return the latest person value and preserve the manager's draft for an explicit choice; same-value retries can confirm a write after a lost response. The week-long direction is a collaborative scenario planner with explainable allocation suggestions, validated calendars/history, and live shared plans.

- Added a read-only per-person, per-week project breakdown using the same weekday and additive-row semantics as the grid. The Dee January 5 golden case resolves 45 hours into Atlas 30 hours across 15 rows and Corvus 15 hours across 15 rows. The drawer provides week navigation.
- Completed isolated synthetic scale verification with 3,000 people and 757,170 assignments in resource-limited containers. All 30 roster pages were traversed; independent arithmetic matched 21,000 wide-range cells and 3,000 one-week values. The browser rendered 50 people across 105 weeks. These are local sequential observations using repeated seed patterns. New benchmark resources were removed; the main preview retained 500 people and 126,195 assignments.

- Final current-candidate checks pass: 12 Go tests including real PostgreSQL fixtures, go vet, 14 frontend tests, the production build, and live browser flows for roster search, concurrent edits, explicit conflict choices, uncertain writes, mobile navigation, multi-year labels, and project details. Independent final review found no actionable defects. Test capacity was restored.
