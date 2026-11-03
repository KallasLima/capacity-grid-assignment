# Capacity view

Managers need to see who is over-committed before the week starts, not after. This is a
small slice of that: allocation against capacity, per person, per week.

This capacity view will be one component of a team overview page, alongside a timeline
of the team's logged time. For this assignment, build only the capacity view. In
production this page serves rosters of a few thousand people and up to two years of
history. The seed is smaller. Design for the real one, and write down what you deferred.

Budget about ninety minutes. The scaffold runs already — `make up` gives you a working
database, a working API, and a working dev server. Three things are stubbed out and yours
to build.
You do not need Go, Node.js, or Postgres installed locally.

Spend the time where a senior frontend engineer would: the editing flow, what the manager
sees while things load, fail, or arrive late, and keeping the grid correct after a save.
The query should be sound and scoped, not clever.

## Requirements

- Docker with Docker Compose v2
- Make
- Ports 3000 and 8080 available

## Running it

From the repository root:

```bash
make up
```

Web on http://localhost:3000, API on http://localhost:8080.
`GET /api/health` works today and tells you the database is seeded.

`make up` stays in the foreground. Leave it running while you work and press `Ctrl-C` to
stop it. Frontend changes reload automatically. After a backend change, stop and run
`make up` again so the API is rebuilt.

Useful commands:

```bash
make down   # stop and remove the containers
make reset  # wipe the database and re-seed it
make logs   # follow API logs
make psql   # open a Postgres shell
```

## What to build

1. **`GET /api/capacity?from=&to=`** in `api/capacity.go` — for every person and every
   week in the range, how many hours they're allocated and how much capacity they have.
2. **`CapacityGrid`** in `web/src/CapacityGrid.tsx` — people down the side, weeks across
   the top, over-allocation obvious at a glance. Users should be able to navigate
   backward and forward by week and choose a date range from the UI.
3. **Editing capacity** — a manager can change someone's weekly hours from the grid.
   `PATCH /api/people/{id}` is stubbed in `api/people.go`. After saving, the numbers
   on screen must be correct without a full page reload — how they get there (refetch
   the range, patch what you already have, something optimistic) is a decision we'll
   ask about, so write it down. Saves can fail; what the manager sees when one does is
   part of the task.

The JSON shape between them is undefined on purpose. It's your API; design it.

## The data

`db/schema.sql` and `db/seed.sql` hold the team and their assignments. Read them.
They're fixed input — don't edit them.

## Ground rules

- **Use AI tools.** We do, all day. This task assumes it.
- **Use whatever dependencies help.** The API already includes `sqlx`, which we use in
  Focus API, but using it is optional.
- **Don't touch the run environment** — Compose files, Dockerfiles, the Makefile, the
  schema, or the seed. We rebuild submissions with our own copies of those, so changes
  there are lost anyway.
- **Commit as you go** on a feature branch, and don't squash. The history is useful to us.
- **Vitest is installed.** `docker compose exec web npm test` runs it. A test or two around
  the parts you'd be nervous to change is worth more to us than a full suite.

## When you're done

**Start it, open it, and look at the numbers.** Do they say what you expect? If something
looks off, either fix it or write down in `DECISIONS.md` that you saw it and why you left
it. Both are fine answers. Not looking is the one thing that isn't.

Then fill in `DECISIONS.md` — it's short, and it's the first thing we read.

## How we read this

We spend about ten minutes per submission, on:

- `DECISIONS.md`, in your words
- `.notes/worklog.md`, including decisions or verification that did not make the final summary
- The running grid, and whether the numbers hold up
- The grid as a manager experiences it: loading, editing, a failed save
- The API and query design, and how the view behaves after an edit
- The diff, as a piece of code someone else has to maintain
- Your commit history

Then we talk about it for an hour, live, and extend it together. Come ready to explain
what you decided and why — that conversation is the real point of this exercise, and it's
much easier when the notes are honest about what you didn't get to.

## Implemented behavior

The capacity view includes week navigation, date-range selection, roster search and
pagination, overload prioritization, inline weekly-capacity editing, project breakdowns,
and a capacity scenario planner. Search and overload prioritization work across the
matching roster. Capacity changes apply to every week for that person.
The initial six-week view runs from December 29, 2025 through February 8, 2026.
Range presets cover 3, 6, or 12 weeks; the mobile view keeps one selected week readable.

`GET /api/capacity?from=2025-12-29&to=2026-01-16&offset=0&limit=50` returns normalized
`from`/`to` dates, `weeks` with `start`/`end`, and `people` with `id`, `name`,
`weeklyHours`, and an aligned `allocatedHours` array. `total`, `offset`, and `limit`
describe the roster page. People with no assignments remain visible. The maximum range
is 106 weeks and the maximum page is 100 people; the UI requests 50 at a time.

Add `search=Dee` to filter names using a case-insensitive substring. Search is trimmed,
accepts up to 100 Unicode characters, and treats `%`, `_`, and `\` as literal characters.
Filtering happens before pagination, and `total` reports the matching roster count.

Add `status=all|over` (default `all`) to include everyone or only people whose
allocation exceeds capacity in at least one selected week. Add `sort=name|overload`
(default `name`) to sort by name or highest single-week overload, descending. Ties
use name and ID for stable pagination. Both controls reset the UI to the first page.
The response's `summary` covers the entire eligible roster after search and status
filtering, across every selected week:

```json
{"people":120,"overCapacityPeople":17,"allocatedHours":12345,"availableHours":6789}
```

`availableHours` sums positive remaining capacity per person-week, so one person's
overload does not cancel another person's available hours. The summary is separate
from the visible page's overload count. Saving while a priority filter or sort is
active refreshes the page so membership and ordering remain correct.

`PATCH /api/people/{id}` requires both values:

```json
{"weeklyHours":32,"expectedWeeklyHours":40}
```

The update atomically checks that stored capacity still equals `expectedWeeklyHours`,
then returns the canonical `id`, `name`, and `weeklyHours`. Both values must be 0–168
hours with at most two decimal places. If the capacity changed, HTTP 409 returns
`{"error":"...","person":{"id":4,"name":"Dee Okafor","weeklyHours":50}}`.
The editor retains the draft, shows the latest value, and requires an explicit
**Save my draft** action to apply it against that value. A retry whose requested value
is already stored returns 200, allowing confirmation after a lost response.

Invalid input returns 400, a missing person returns 404, and oversized bodies return
413. Allocation sums all overlapping assignment records on weekdays, including
distinct records with identical values. See [DECISIONS.md](DECISIONS.md) for the choices.

### Capacity scenarios

Choose **Plan capacity**, edit recurring weekly limits, and **Stage change**. Staging
only updates the in-memory preview; it sends no write request. The scenario shows
before/after limits and overloaded person-weeks for the planned people in the selected
range. Restaging retains each person's original expected value. Returning to that
value removes the no-op change. Plans hold up to 100 people, can span roster pages,
and remain local to this browser view. Leaving with drafts prompts a browser warning.

**Apply plan** sends one atomic request:

```http
PATCH /api/people/capacities
Content-Type: application/json

{"changes":[{"id":4,"weeklyHours":50,"expectedWeeklyHours":40},{"id":5,"weeklyHours":24,"expectedWeeklyHours":0}]}
```

The API accepts 1–100 unique, positive person IDs, with the same 0–168 hour and
two-decimal rules as individual edits. It locks affected rows in ID order and checks
every expected value before writing. Success returns `{"people":[...]}` with canonical
values for every requested person. A missing person returns 404 with no changes.
A conflict returns 409 with `error` and canonical `people` for all requested IDs;
that attempt changes nothing. The UI preserves proposed values, updates their
starting values, and requires **Apply reviewed plan**. Values already at the proposal
drop out of the remaining draft.

An identical retry succeeds when the proposed values are already stored, which
confirms a write whose response was lost. After an unconfirmed apply, the UI freezes
staging and removal, retains the draft and warning, and offers retry or **Close and
refresh**. **Discard plan** also refreshes saved values. Applying, discarding, or
removing changes is disabled while an inline editor is open. Plans have no durable
storage or shared-editing mechanism.

### Allocation breakdown

Click a team member's name to open their project breakdown, then move between weeks
inside the drawer. `GET /api/people/4/allocations?week=2026-01-05` returns `person`,
a normalized Monday–Sunday `week`, total `allocatedHours`, and `projects` with `id`,
`name`, `hours`, and `assignmentCount`. This read-only view uses the same weekday and
additive-row rules as the grid. Invalid IDs or dates return 400; a missing person returns
404.

For Dee in the week of January 5, the total is 45 hours: Atlas contributes 30 hours
from 15 assignment rows, and Corvus contributes 15 hours from 15 rows. Compare that sum
with the grid, then change weeks and close the drawer to return to the same person.

### Checks

With the application running through `make up`, run:

```bash
docker compose exec -T api go test -v ./...
docker compose exec -T web npm test
docker compose exec -T web npm run build
```

The current suite has 17 Go tests and 25 frontend tests. The Go query and mutation
tests use temporary PostgreSQL tables inside rolled-back transactions and preserve
the seeded roster. Coverage includes roster-wide summary and priority semantics,
atomic batch conflicts and retries, draft preservation, and obsolete responses.

The current priority query was also checked against independently calculated seed
arithmetic: 75,585 cells across 500 people, plus 31,314 cells in an isolated synthetic
fixture of 3,000 people and 757,170 assignments. Whole-roster summaries, overload
filtering, ordering, search, and first/last pages matched. In that isolated local
fixture, sampled 105-week requests took 1.28–1.30 seconds. These sequential local
observations use repeated seed patterns; concurrent production workloads remain
unmeasured. The browser also rendered 50 people across 105 weeks without page overflow.
To inspect the grid's numbers, use the week of
January 5, 2026: Bo is 32/40 hours, Cem 4/20, Dee 45/40, and Eli 20/0. Edit a capacity,
check every displayed week, then reload to verify persistence. A failed save should
retain the typed value and allow retry.

To check a conflict, open the same person in two browser tabs. Save a change in the
first, then submit a different draft from the second. The second tab should show the
new server value without overwriting it and retain its draft for **Save my draft**
or Cancel.

Cancel or Escape after an unsuccessful save reloads current server values, including
when the write committed but its response was lost. If reconciliation fails, the grid
is replaced by a retry state. Keyboard focus returns to the edited person after recovery.

To inspect a scenario, stage a higher limit for Dee and another person's change.
The grid should preview both without changing saved values in a second tab. Apply
once, then reload the second tab to check persistence. If one starting value changes
in the other tab before applying, the entire batch should conflict without partially
applying the other change.

Vite is patched to 8.2.4. The original Compose, Dockerfile, Makefile, schema, and seed
are unchanged. For local-only access, use a separate uncommitted Compose override that
replaces published ports with loopback bindings. No authentication is included in this
local assignment scaffold.
