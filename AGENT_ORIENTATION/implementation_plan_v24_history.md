# Implementation Plan - Phase 24 Stabilization

## Goal Description
Complete the Phase 24 stabilization of the GeoKanban UI. This involves fixing missing/incorrect icons in the "Vessel Activity" tab, making the stand-by declaration button more visible and persistent in the "Schedule" tab, and ensuring Admin profiles cannot edit activities.

## Proposed Changes

### [Component] Vessel Activity Tab - Admin KPI Console [NEW DESIGN]
#### [MODIFY] [VesselActivityTab.jsx](file:///c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/src/components/VesselActivityTab.jsx)
- [ ] Redesign the 4 top KPI cards to match the requested premium design:
  - "MONTH LOADING", "MONTH NAVIGATION", "MONTH UNLOADING", "TRACKED VESSELS".
  - Icon in a circular/rounded background on the left.
  - Label above, large value below.
  - Soft shadows, `rounded-[2rem]`, and `backdrop-blur`.
- [ ] Ensure counters reflect the data for the selected month accurately.
- [ ] Maintain the "KPI / M" table below with its professional styling.

### [Component] Stand-by Schedule - "+" Button Enhancement
#### [MODIFY] [StandbySchedule.jsx](file:///c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/src/components/StandbySchedule.jsx)
- [ ] Make the "+" button significantly more evident for Crew.
- [ ] Use a consistent Premium UI style (better contrast, shadow, and visible always).
- [ ] Ensure clicking the button (or the cell) starts the `Stand-by Declaration` modal.
- [ ] Verify that the dropdown fetches reasons from the Database (via `standbyReasons`).

### [Component] Vessel Activity - Status Icon & Hardening
#### [VERIFY] [VesselActivityTab.jsx](file:///c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/src/components/VesselActivityTab.jsx)
- [ ] Confirm `CheckCircle` is always shown in STATUS column (implemented).
- [ ] Confirm "EDIT" button is ONLY visible for Crew and for draft activities (implemented).

## Verification Plan

### Manual Verification
- **Vessel Activity Tab**:
  1. Open the app as an Admin (`operation_admin`).
  2. Go to the "Vessel Activity" tab.
  3. Verify the "STATUS" column shows a `CheckCircle` icon for all rows.
  4. Verify draft rows are light gray and submitted rows are green.
  5. Verify there are no "EDIT" buttons.
- **Standby Schedule Tab**:
  1. Open the app as standard `crew`.
  2. Go to the "Schedule" tab.
  3. Verify all future calendar cells have a persistent "+" button in the top right.
  4. Click the "+" button and verify it opens the "Stand-by Declaration" modal.
  5. Verify the modal has a dropdown with reasons from "Stand-by reasons" list.
- **Role Permissions**:
  1. Verify `operation` and `operation_admin` cannot see "EDIT" buttons in "Vessel Activity".
  2. Verify `operation` and `operation_admin` cannot see the "+" button in "Schedule" cells (they can still see the sidebar).
