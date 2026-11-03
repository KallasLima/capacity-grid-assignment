# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

## Initial security checkpoint, November 3, 2026

- Updated Vite from 8.2.2 to 8.2.4 for published dev-server security fixes. A local, Git-excluded Compose override replaces both published bindings with 127.0.0.1 while preserving the fixed submission environment. Dependency installation with lifecycle scripts disabled and the TypeScript/production build passed. The effective Compose configuration has one loopback-only mapping per service; containers were not started because the Docker engine was stopped.

- Built the capacity API with roster-page/range scoping and full-week weekday aggregation. Checked the full seed rather than deduplicating equal-looking assignments; Jan 5 golden totals include Dee 45/40 and Eli 20/0. Go validation and PostgreSQL fixture tests pass.
- Implemented a paginated grid and confirmed-save editing. Old range responses are ignored, failed saves preserve drafts, and navigation waits for Save/Cancel. Review caught low contrast and lost editor focus; both were corrected and verified with keyboard/browser interactions.
- Docker Desktop did not forward file-change events to the initial Vite process; enabled polling in the editable Vite configuration. Browser checks cover persisted edits, injected failed saves and loads with recovery, pagination/week navigation, and a 390px mobile view. A two-year view rendered 50 people × 105 weeks locally in about 1.2 seconds; this is one local observation, not a production benchmark. The full organization's data is paged.
## Core checkpoint, November 3, 2026: 4 frontend tests

- Checks at this stage used the supplied container runtime: Go tests including real transactional PostgreSQL fixtures, 4 frontend behavior tests, and the TypeScript/Vite production build. Private browser scripts and screenshots remain outside the repository.

- A fresh parallel requirements audit independently matched all 5,250 cells in a 50-person, 105-week response against the seed. No acceptance gap or fixed-input/environment change was found.
- Review found an uncertain-write recovery defect: a PATCH could commit before its response was lost, then Cancel left stale numbers. Cancel/Escape after an unsuccessful attempt now clears and reloads the grid, restores the row's focus after recovery, and offers focused Retry if that reconciliation fails. Added delayed-response regression tests and exercised real committed-but-dropped responses plus failures before commit; restored test capacity afterward.
- Review also reproduced a mobile keyboard editor hidden beneath the sticky name column. Responsive scroll padding now keeps the input and Save visible; a narrow-screen cue explains horizontal scrolling. Verified the exact keyboard reproduction at 390px. All 6 frontend behavior tests and the container production build pass; the unchanged backend's Go tests remain green.

- Expanded the manager workflow with literal roster search before pagination and atomic compare-and-set capacity updates. Conflicts return the latest person value and preserve the manager's draft for an explicit choice; same-value retries can confirm a write after a lost response. The week-long direction is a collaborative scenario planner with explainable allocation suggestions, validated calendars/history, and live shared plans.

- Added a read-only per-person, per-week project breakdown using the same weekday and additive-row semantics as the grid. The Dee January 5 golden case resolves 45 hours into Atlas 30 hours across 15 rows and Corvus 15 hours across 15 rows. The drawer provides week navigation.
- Completed isolated synthetic scale verification with 3,000 people and 757,170 assignments in resource-limited containers. All 30 roster pages were traversed; independent arithmetic matched 21,000 wide-range cells and 3,000 one-week values. The browser rendered 50 people across 105 weeks. These are local sequential observations using repeated seed patterns. New benchmark resources were removed; the main preview retained 500 people and 126,195 assignments.

## Expanded-workflow checkpoint, November 3, 2026: 14 frontend tests

- Checks at this stage passed: 12 Go tests including real PostgreSQL fixtures, go vet, 14 frontend tests, the production build, and live browser flows for roster search, concurrent edits, explicit conflict choices, uncertain writes, mobile navigation, multi-year labels, and project details. Independent final review found no actionable defects. Test capacity was restored.

- Added whole-roster overload filtering, peak-overload ordering, and saved summaries before pagination. Updated query verification matched 75,585 allocation cells in the fixed seed and 31,314 cells in a separate 3,000-person / 757,170-assignment fixture. Sample two-year requests took 1.28–1.30 seconds locally; this supersedes the earlier query's timing. Temporary proof resources were removed.
- Added browser-local recurring-capacity scenarios with projected rows and before/after overload impact. Staging sends no writes; explicit apply atomically compares and changes up to 100 people. Conflicts preserve proposals for review. An unconfirmed apply freezes draft edits/removal until an identical retry or close-and-refresh reconciles the result.
## Scenario checkpoint, November 3, 2026: 25 frontend tests

- Browser checks at this stage passed two-person apply, all-or-none competing edits, lost committed responses, safe retry and close recovery, filtered-row focus, and mobile planning. Seventeen Go tests, go vet, 25 frontend tests and the production build pass. Fresh independent code judgment found no actionable defects. Main fixture capacities were restored; no push or submission.


## Presentation checkpoint, November 3, 2026: 26 frontend tests

- Compacted the grid presentation and date-range controls, restored focus to the custom-date trigger after apply, and clarified recovery when the matching roster shrinks past the current page. The current frontend suite contains 26 tests; the backend suite contains 17 tests. README now leads with the implemented workflow and a short review tour; the exact original brief is preserved in ASSIGNMENT.md and detailed contracts in docs/API.md.

## Presentation follow-up, November 3, 2026

- Added source comments, logical spacing, CSS sections, clickable architecture references, and clearer API examples. Removed nine superseded identical CSS declarations. A narrow-screen check with fractional summary totals found horizontal overflow; the summary now uses two columns below 421px. Browser comparisons covered seven widths and grid, scenario, and project-detail states; emitted frontend JavaScript and executable Go tokens remain unchanged. The 26 frontend tests and production build pass, and README screenshots reflect the updated layout.

## Planning and recovery checkpoint, November 3, 2026: 47 frontend tests

- Planning now keeps the current search, overload filter, sort, and page. Filters use saved capacities while rows preview proposals; dates remain locked. Project details stay available and distinguish the saved limit from a proposed limit, including zero.
- Added validated, versioned browser-local backups with 24-hour expiry and explicit Restore/Discard. Restore checks current capacities through existing read-only endpoints. Changed baselines require review; a request in flight is backed up as uncertain before sending so refresh retains the original retry intent. Separate plan keys and source-revision markers protect other tabs' backups; unavailable storage leaves an in-memory workflow with a warning.
- Actual Chrome flows passed refresh and closed-tab recovery, preserved view context, zero writes before explicit Apply, failed recovery/retry, changed-baseline review, two-person persistence, a committed in-flight request followed by refresh and identical retry, and independent-tab cleanup. Review caught recovery interrupting an ordinary editor; recovery now respects the edit/save lock, with component and integrated regressions. All 47 frontend tests and the production build pass. The API and protected schema, seed, Compose, Dockerfile, and Makefile remain unchanged; test capacities were restored.
