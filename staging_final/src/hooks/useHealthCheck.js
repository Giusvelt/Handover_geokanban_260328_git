import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useHealthCheck — Permanent system integrity verifier.
 * Runs inside the app (admin only). No throwaway scripts.
 * 
 * Validates the full pipeline:
 * vessels → geofence_events → vessel_activity → logbook_entries
 */
export function useHealthCheck() {
    const [results, setResults] = useState(null);
    const [running, setRunning] = useState(false);

    const runCheck = useCallback(async () => {
        setRunning(true);
        const checks = [];

        const ok = (name, detail) => checks.push({ name, status: 'ok', detail });
        const fail = (name, detail) => checks.push({ name, status: 'fail', detail });
        const warn = (name, detail) => checks.push({ name, status: 'warn', detail });

        try {
            // 1. Vessels
            const { data: vessels, error: vErr } = await supabase
                .from('vessels').select('id, name, mmsi');
            if (vErr) fail('Vessels', vErr.message);
            else if (vessels.length >= 7) ok('Vessels', `${vessels.length} vessels`);
            else warn('Vessels', `Only ${vessels.length} vessels (expected 7+)`);

            // 2. Geofences
            const { count: geoCount } = await supabase
                .from('geofences').select('*', { count: 'exact', head: true });
            if (geoCount >= 10) ok('Geofences', `${geoCount} geofences`);
            else warn('Geofences', `Only ${geoCount} geofences`);

            // 3. Geofence Events
            const { count: evtCount } = await supabase
                .from('geofence_events').select('*', { count: 'exact', head: true });
            ok('Geofence Events', `${evtCount} events`);

            // 4. Vessel Activity
            const { data: activities, error: aErr } = await supabase
                .from('vessel_activity').select('id, vessel_id, status, source, start_event_id');
            if (aErr) {
                fail('Vessel Activity', aErr.message);
            } else {
                const total = activities.length;
                const active = activities.filter(a => a.status === 'active').length;
                const completed = activities.filter(a => a.status === 'completed').length;
                const auto = activities.filter(a => a.source === 'geofence').length;
                const manual = activities.filter(a => a.source === 'manual').length;
                ok('Vessel Activity', `${total} total (${active} active, ${completed} done, ${auto} auto, ${manual} manual)`);

                // 4b. Check all auto activities have start_event_id
                const orphanAuto = activities.filter(a => a.source === 'geofence' && !a.start_event_id);
                if (orphanAuto.length > 0) {
                    warn('Auto Activity Integrity', `${orphanAuto.length} auto activities without start_event_id`);
                } else {
                    ok('Auto Activity Integrity', 'All auto activities linked to events');
                }

                // 4c. Activities per vessel
                const vesselCounts = {};
                for (const a of activities) {
                    const v = vessels?.find(x => x.id === a.vessel_id);
                    const name = v?.name || 'Unknown';
                    vesselCounts[name] = (vesselCounts[name] || 0) + 1;
                }
                const perVessel = Object.entries(vesselCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([n, c]) => `${n}: ${c}`)
                    .join(', ');
                ok('Activity Distribution', perVessel);
            }

            // 5. Activity Messages
            const { count: msgCount } = await supabase
                .from('activity_messages').select('*', { count: 'exact', head: true });
            ok('Activity Messages', `${msgCount} messages`);

            // 6. Logbook Entries
            const { data: logbooks } = await supabase
                .from('logbook_entries').select('id, status, vessel_activity_id');
            if (logbooks) {
                const byStatus = {};
                logbooks.forEach(l => { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });
                const statusStr = Object.entries(byStatus).map(([s, c]) => `${s}: ${c}`).join(', ') || 'empty';
                ok('Logbook Entries', statusStr);

                // 6b. Check for orphaned logbooks
                if (logbooks.length > 0 && activities) {
                    const actIds = new Set(activities.map(a => a.id));
                    const orphans = logbooks.filter(l => !actIds.has(l.vessel_activity_id));
                    if (orphans.length > 0) {
                        fail('Logbook Integrity', `${orphans.length} logbook entries reference non-existent activities`);
                    } else {
                        ok('Logbook Integrity', 'All logbooks linked to valid activities');
                    }
                }
            }

            // 7. User Profiles
            const { data: profiles } = await supabase
                .from('user_profiles').select('id, role, display_name, vessel_id');
            if (profiles) {
                const admins = profiles.filter(p => p.role === 'admin').length;
                const crew = profiles.filter(p => p.role === 'crew').length;
                ok('User Profiles', `${profiles.length} total (${admins} admin, ${crew} crew)`);
            }

            // 8. Logbook Services
            const { count: svcCount } = await supabase
                .from('logbook_services').select('*', { count: 'exact', head: true });
            ok('Logbook Services', `${svcCount} entries`);

        } catch (err) {
            fail('System Error', err.message);
        }

        setResults(checks);
        setRunning(false);
    }, []);

    return { results, running, runCheck };
}
