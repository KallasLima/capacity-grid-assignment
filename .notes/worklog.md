# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

- Updated Vite from 8.2.2 to 8.2.4 for published dev-server security fixes. A local, Git-excluded Compose override replaces both published bindings with 127.0.0.1 while preserving the fixed submission environment. Dependency installation with lifecycle scripts disabled and the TypeScript/production build passed. The effective Compose configuration has one loopback-only mapping per service; containers were not started because the Docker engine was stopped.

- Built the capacity API with roster-page/range scoping and full-week weekday aggregation. Checked the full seed rather than deduplicating equal-looking assignments; Jan 5 golden totals include Dee 45/40 and Eli 20/0. Go validation and PostgreSQL fixture tests pass.
- Implemented a paginated grid and confirmed-save editing. Old range responses are ignored, failed saves preserve drafts, and navigation waits for Save/Cancel. Review caught low contrast and lost editor focus; both were corrected and verified with keyboard/browser interactions.
- Docker Desktop did not forward file-change events to the initial Vite process; enabled polling in the editable Vite configuration. Browser checks cover persisted edits, injected failed saves and loads with recovery, pagination/week navigation, and a390px mobile view. A two-year view rendered50people ×105weeks locally in about1.2seconds; this is one local observation, not a production benchmark. The full organization's data is paged.
- Final checks use the supplied container runtime: Go tests including real transactional PostgreSQL fixtures,4frontend behavior tests, and the TypeScript/Vite production build. Private browser scripts and screenshots remain outside the repository.
