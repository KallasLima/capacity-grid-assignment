# Decisions

## What did the spec not tell you?

- Weeks start on Monday and include the selected dates' complete weeks. Assignment dates are inclusive; allocation counts weekdays without holidays. Capacity recurs across every week because the fixed schema stores one value per person.
- Literal, case-insensitive name search precedes allocation scoring. Overload filtering, highest-overload ordering, and summary totals cover the entire eligible roster before pagination. Overload means any selected week exceeds capacity; ordering uses peak weekly excess, then name and ID. Available hours sum positive headroom per person-week. The grid renders 50 people by default, at most 100, across at most 106 weeks; database work includes the matching roster to make prioritization accurate.
- Saves compare the opened capacity with the stored value. Conflicts return the latest value and retain the draft for an explicit decision. Confirmed saves update every visible week. Failed saves retain drafts; Cancel/Escape reload current values. Obsolete requests cannot replace newer selections or edits.
- A scenario previews recurring capacity limits in memory without writing. One transaction applies 1–100 distinct people, locking rows in ID order and checking every expected value before updates. A conflict applies nothing and returns all requested current values for explicit review. Already-applied values make an identical retry safe. An unconfirmed apply freezes draft edits and removal until retry or close-and-refresh; plans are neither persisted nor shared.

## What did you notice that looked wrong?

- Fractional daily values and equal-looking assignments with distinct IDs require summing every supplied row. For January 5, Dee has 45 allocated hours against 40 capacity; Eli has 20 against zero, an overload handled without division by zero. The input is preserved.

## What did the AI get wrong that you caught?

- The first editing flow assumed a failed request left the server unchanged. A write can commit before its response is lost: Cancel hid the error while retaining old numbers. Cancel/Escape now reconcile with the server, covered by delayed-response and real dropped-response checks. The same review caught that removing an uncertain scenario change could erase the retry intent; its draft now stays frozen, with a regression covering identical retry.

## What would you do differently with a week?

- Extend the implemented recurring-limit planner into collaborative scenario branches: compare alternative staffing plans, show their delivery risk and cost, and publish an agreed plan with an audit trail and undo.
- Model calendar-aware capacity with effective dates, PTO, public holidays, and individual working schedules. Use that foundation for explainable allocation-rebalancing recommendations constrained by skills, priorities, deadlines, and availability, with reviewable tradeoffs before applying. The fixed schema currently supplies a single recurring limit, so changing it affects past and future weeks.
