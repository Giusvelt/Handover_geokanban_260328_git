import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useActivityStore = create((set, get) => ({
    activities: [],
    productionPlans: [],
    fleetKPIs: [],
    vesselKPIs: [],
    loading: false,
    error: null,
    lastUpdate: null,

    fetchActivities: async (vesselId = null, userRole = null) => {
        set({ loading: true });
        try {
            let query = supabase
                .from('vessel_activity')
                .select(`
                    id, vessel_id, activity_type, geofence_id, start_time, end_time,
                    duration_minutes, source, status, export_flag,
                    vessels ( name, mmsi ),
                    geofences ( name, nature ),
                    logbook_entries ( status, structured_fields ),
                    activity_messages ( id, is_read, sender_role )
                `)
                .or('duration_minutes.gte.20,duration_minutes.is.null')
                .order('start_time', { ascending: false });
            
            if (vesselId) {
                query = query.eq('vessel_id', vesselId);
            }

            const { data, error } = await query;
            if (error) throw error;
            
            // Map to flat format expected by UI
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
                status: row.status === 'active' ? 'in-progress' : 'completed',
                logbookStatus: row.logbook_entries?.[0]?.status || 'none',
                deliveredQty: row.logbook_entries?.[0]?.structured_fields?.actual_cargo_tonnes || null,
                msgCount: row.activity_messages?.filter(m => !m.is_read && m.sender_role !== userRole).length || 0,
                unreadMsgCount: row.activity_messages?.filter(m => !m.is_read && m.sender_role !== userRole).length || 0,
                totalMsgCount: row.activity_messages?.length || 0
            }));

            set({ 
                activities: mapped, 
                lastUpdate: new Date() 
            });
        } catch (err) {
            set({ error: err.message });
        } finally {
            set({ loading: false });
        }
    },

    fetchFleetKPIs: async () => {
        try {
            const { data, error } = await supabase.from('monthly_fleet_kpi').select('*');
            if (error) throw error;
            set({ fleetKPIs: data || [] });
        } catch (err) {
            console.error(err);
        }
    },

    fetchVesselKPIs: async () => {
        try {
            const { data, error } = await supabase.from('monthly_vessel_kpi').select('*');
            if (error) throw error;
            set({ vesselKPIs: data || [] });
        } catch (err) {
            console.error(err);
        }
    },

    fetchPlans: async () => {
        try {
            const { data, error } = await supabase.from('production_plans').select('*');
            if (error) throw error;
            set({ productionPlans: data || [] });
        } catch (err) {
            console.error(err);
        }
    },

    upsertPlan: async (plan) => {
        try {
            const { error } = await supabase.from('production_plans').upsert(plan);
            if (error) throw error;
            get().fetchPlans();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    deletePlan: async (id) => {
        try {
            const { error } = await supabase.from('production_plans').delete().eq('id', id);
            if (error) throw error;
            get().fetchPlans();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
}));
