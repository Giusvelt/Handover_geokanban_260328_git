# Task: Phase 24 Stabilization

## Vessel Activity - Status Icon [x]
- [x] Modify `VesselActivityTab.jsx` to always show `CheckCircle` icon in STATUS column.
- [x] Ensure `CheckCircle` is light gray if `!isSubmitted` and green if `isSubmitted`.
- [x] Ensure icon is visible for all roles (including Admin) even if they cannot edit.
- [x] Replace `FileText` with `CheckCircle` for draft activities.

## Schedule - Standby "+" Button [x]
- [x] Refine `StandbySchedule.jsx` to make the "+" button very evident and persistent.
- [x] Ensure the button styling matches "Premium UI" (larger, better colors/shadows).
- [x] Verify functionality for Crew: opening `Stand-by Declaration` modal with DB reasons.

## Vessel Activity - Admin KPI Console [x]
- [x] Redesign the KPI cards to match the user's screenshot exactly ("MONTH LOADING", etc.).
- [x] Ensure the logic for counters is robust and consistent with the KPI table.
- [x] Restore the "beautiful" styling with premium cards and shadows.

## Hardening Admin [x]
- [x] Verify `operation_admin` and `operation` roles cannot see "EDIT" buttons in `VesselActivityTab.jsx`.
- [x] Check if any other "EDIT" buttons exist that should be removed for these roles.

## Verification [x]
- [x] Verify UI changes in both tabs.
- [x] Test with different user roles (Crew vs Admin).
