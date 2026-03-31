# CHANGELOG - GeoKanban V3 Detailed History

## Phase 24 - Stabilization & Premium UI (Last Session)
- **Restored Premium Dashboard**: Reactivated `stats-row` and `stat-card` CSS for the Admin KPI console.
- **Rigid KPI Calculation**: Linked all dashboard metrics to the `monthly_fleet_kpi` database view. 
- **Enhanced Crew Schedule**: Implemented a persistent blue "+" button for easier standby declarations.
- **Icon Standardization**: Uniformed `CheckCircle` icons across the Vessel Activity list.
- **Bug Fix**: Resolved a `ReferenceError` caused by a state dependency mismatch in `VesselActivityTab.jsx`.

## Phase 21-23 - Mobile & Security Hardening
- **Surgical RLS**: Implemented row-level security on all Supabase tables.
- **Admin Read-Only**: Removed all "Edit" buttons for Admin/Operation roles on activity lists.
- **Mobile Versioning**: Unified version naming across mobile and desktop headers.

## Phase 18-20 - Enterprise Features & Audit
- **Audit Trail**: Technical implementation of device fingerprinting and audit logs.
- **Nautical Time Picker**: Phase 17 implementation for precise maritime time entry.
- **SQL BI Integration**: Optimized data fetching via materialized logic for KPIs.

## Historical Milestones (Phase 1-15)
- **Zustand stores**: Complete store refactoring for higher performance.
- **Responsive Logbook**: Unification of mobile and desktop entry modals.
- **MMSI Fallback**: Stable vessel identification logic.
- **Polygon Geofencing**: Advanced PostGIS-based vessel tracking.
- **PWA Setup**: Full progressive web app transformation.

---
*Storico compilato in data 28/03/2026.*
