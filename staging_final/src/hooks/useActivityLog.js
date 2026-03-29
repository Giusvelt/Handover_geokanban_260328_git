import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUserProfile } from './useUserProfile';

/**
 * useActivityLog V3.2 — Reads from vessel_activity (materialized)
 * instead of recalculating from geofence_events.
 *
 * @param {string|null} vesselId — If provided, filters for a single vessel (crew mode)
 */
export function useActivityLog(vesselId = null) {
    const { profile } = useUserProfile();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);

    const fetchActivities = useCallback(async () => {
        setLoading(true);

        try {
            let query = supabase
                .from('vessel_activity')
                .select(`
                    id,
                    vessel_id,
                    activity_type,
                    geofence_id,
                    start_time,
                    end_time,
                    duration_minutes,
                    source,
                    status,
                    export_flag,
                    vessels ( name, mmsi ),
                    geofences ( name, nature ),
                    logbook_entries ( status, structured_fields ),
                    activity_messages ( id, is_read, sender_role )
                `)
                .order('start_time', { ascending: false });

            // Crew filter: only their vessel
            if (profile?.role === 'crew' && !vesselId) {
                setActivities([]);
                setLoading(false);
                return;
            }

            if (vesselId) {
                query = query.eq('vessel_id', vesselId);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Fetch latest weather for all vessels to show "current" weather in list
            const { data: weatherData } = await supabase
                .from('weather_logs')
                .select('*')
                .order('timestamp', { ascending: false });

            // Map weather to vessel mmsi for easy lookup
            const weatherByVessel = {};
            (weatherData || []).forEach(w => {
                const mmsi = w.location_name?.replace('Vessel: ', '');
                if (!weatherByVessel[mmsi]) {
                    weatherByVessel[mmsi] = {
                        wind_speed: Math.round((w.wind_speed || 0) / 1.852), // Convert km/h to knots
                        wind_direction: w.wind_direction,
                        wave_height: w.wave_height,
                        temp: w.temperature
                    };
                }
            });

            // Map to format expected by VesselActivityTab
            const mapped = (data || []).map(row => ({
                id: row.id,
                vessel: row.vessels?.name || 'Unknown',
                vesselId: row.vessel_id,
                mmsi: row.vessels?.mmsi,
                activity: row.activity_type,
                geofence: row.geofences?.name || '—',
                geofenceId: row.geofence_id,
                startTime: row.start_time,
                endTime: row.end_time,
                durationMinutes: row.duration_minutes,
                source: row.source,
                status: row.status === 'active' ? 'in-progress' : 'completed',
                exportFlag: row.export_flag,
                logbookStatus: row.logbook_entries?.[0]?.status || 'none',
                deliveredQty: row.logbook_entries?.[0]?.structured_fields?.actual_cargo_tonnes || null,
                msgCount: row.activity_messages?.length || 0,
                unreadMsgCount: row.activity_messages?.filter(m => !m.is_read && m.sender_role !== profile?.role).length || 0,
                weather: weatherByVessel[row.vessels?.mmsi] || null
            }));

            setActivities(mapped);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Failed to load vessel_activity:', err.message);
        } finally {
            setLoading(false);
        }
    }, [vesselId, profile?.role]);

    useEffect(() => {
        fetchActivities();
        const interval = setInterval(fetchActivities, 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchActivities]);

    return { activities, loading, lastUpdate, fetchActivities };
}
