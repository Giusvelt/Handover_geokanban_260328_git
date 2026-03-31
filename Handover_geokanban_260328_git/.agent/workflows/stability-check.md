---
description: Verify the stability and data integrity of the GeoKanban application
---

# Stability Check Workflow

This workflow validates the full data pipeline: tracking → geofence events → vessel_activity → display.

## When to Run
- After any schema migration
- After modifying hooks that read/write Supabase data
- After modifying DataContext or any data flow
- Before any commit

## Steps

// turbo-all

1. Verify the dev server is running
```
cd c:\Users\giuse\Desktop\ANTIGRAVITY\GK_2\GK_V3 && npm run dev
```

2. Run the built-in health check (admin login required)
Open the app in browser → Login as admin → Click "DB Manager" tab → Check the "System Health" section at the top.

The health check verifies:
- [ ] All 7 vessels exist in DB
- [ ] Geofence events count matches vessel_activity count logic (each ENTER = 1 activity)
- [ ] Every vessel_activity has a valid vessel_id FK
- [ ] Every vessel_activity with source='geofence' has a start_event_id
- [ ] No orphaned logbook_entries (all reference valid vessel_activity)
- [ ] No orphaned activity_messages (all reference valid vessel_activity)
- [ ] Crew view filter works (crew user sees only their vessel)
- [ ] Trigger `trg_materialize_activity` is active on geofence_events
- [ ] Trigger `trg_freeze_logbook` is active on logbook_entries

3. If the health check shows failures, investigate:
- Check browser console for Supabase errors
- Verify RLS policies are not blocking data
- Verify the user is logged in as admin (not crew)

## Data Flow (what the check validates)

```
Datalastic API → vessel_tracking (positions)
                         ↓
              Edge Function processes
                         ↓
              geofence_events (ENTER/EXIT)
                         ↓ trigger: materialize_vessel_activity()
              vessel_activity (54+ records)
                         ↓
              useActivityLog.js reads vessel_activity
                         ↓
              VesselActivityTab displays table
                         ↓
              Crew: filtered by vessel_id
              Admin: sees all
```

## Quick Manual Check
If the app shows data in Vessel Activity tab:
- Admin: should see multiple vessels (ANNAMARIA Z, SIDER ORION, SIDER BEAR, etc.)
- Crew: should see ONLY their assigned vessel
- Total events should match `SELECT count(*) FROM vessel_activity`
