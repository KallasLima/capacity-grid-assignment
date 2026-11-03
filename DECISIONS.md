# Decisions

## What did the spec not tell you?

- Weeks start on Monday and include the selected dates' complete weeks. Assignment dates are inclusive; allocation counts weekdays without holidays. Capacity recurs across every week because the fixed schema stores one value per person.
- Literal, case-insensitive name search filters the roster before stable pagination and aggregation: 50 people by default, at most 100, across at most 106 weeks. Query and rendering work stay bounded.
- Saves compare the opened capacity with the stored value. Conflicts return the latest value and retain the draft for an explicit decision. Confirmed saves update every visible week. Failed saves retain drafts; Cancel/Escape reload current values. Obsolete requests cannot replace newer selections or edits.

## What did you notice that looked wrong?

- Fractional daily values and equal-looking assignments with distinct IDs require summing every supplied row. For January 5, Dee has 45 allocated hours against 40 capacity; Eli has 20 against zero, an overload handled without division by zero. The input is preserved.

## What did the AI get wrong that you caught?

- The first editing flow assumed a failed request left the server unchanged. A write can commit before its response is lost: Cancel hid the error while retaining old numbers. Cancel/Escape now reconcile with the server, covered by delayed-response and real dropped-response checks.

## What would you do differently with a week?

- Turn this slice into a collaborative scenario planner: create alternative staffing plans, compare delivery risk and cost, and publish or undo an agreed plan. Add explainable allocation suggestions constrained by skills, priorities, deadlines, and availability.
- Connect live shared editing, historical capacity, and PTO calendars to validated domain models. Prove scenario publishing and rollback under multi-manager failures, accessible interaction, and concurrent workloads across thousands of people. The current scalar capacity deliberately applies to past and future weeks.
