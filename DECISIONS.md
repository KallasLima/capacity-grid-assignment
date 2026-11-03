# Decisions

## What did the spec not tell you?

- Weeks start on Monday; the selected dates include their complete weeks. Assignment dates are inclusive, and allocation counts Monday–Friday with no holiday calendar. Weekly capacity is recurring across every week because the fixed schema has one value per person.
- The API pages the roster before aggregating overlapping assignments: 50 people by default, at most 100, across at most 106 weeks. This bounds both query work and rendered cells without loading the whole organization into the browser.
- Saves are confirmed, then the canonical returned capacity updates every visible dependent number. Failed saves retain the draft. Obsolete range requests are cancelled and ignored; a late response cannot restore capacity from before a confirmed edit. A later fresh request remains authoritative.

## What did you notice that looked wrong?

- The seed has small fractional daily values and many equal-looking assignments with distinct IDs. Summing all supplied rows matters: for January 5, Dee has 45 allocated hours against 40 capacity. Eli has 20 against zero; that is an overload, not an infinite percentage. The fixed input is preserved.

## What did the AI get wrong that you caught?

- The first dependency update churned unrelated platform metadata in the lockfile. Diff review caught it, the original entries were retained, and the security update was narrowed to Vite and its matching lock record.

## What would you do differently with a week?

- Extend keyboard and screen-reader testing, measure wide-range rendering with larger rosters, and add concurrency protection for two managers editing the same person. Confirm holiday and historical-capacity requirements before adding those models. The present scalar capacity deliberately applies to past and future weeks.
