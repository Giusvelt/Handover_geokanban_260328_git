import { create } from 'zustand';
import { supabase } from '../lib/supabase';

/**
 * Vessel Store
 * Manages the fleet list, historical tracking, and real-time positions.
 */
export const useVesselStore = create((set, get) => ({
    vessels: [],
    vesselPositions: [],
    loading: false,
    error: null,
    
    // Core Actions
    setVessels: (vessels) => set({ vessels }),
    
    fetchVessels: async () => {
        set({ loading: true });
        try {
            const { data, error } = await supabase
                .from('vessels')
                .select('*')
                .order('name');
            if (error) throw error;
            set({ vessels: data || [] });
        } catch (err) {
            set({ error: err.message });
        } finally {
            set({ loading: false });
        }
    },

    addVessel: async (vessel) => {
        try {
            const { data, error } = await supabase.from('vessels').insert(vessel).select().single();
            if (error) throw error;
            set(state => ({ vessels: [...state.vessels, data] }));
            return { success: true, data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    updateVessel: async (id, updates) => {
        try {
            const { error } = await supabase.from('vessels').update(updates).eq('id', id);
            if (error) throw error;
            set(state => ({
                vessels: state.vessels.map(v => v.id === id ? { ...v, ...updates } : v)
            }));
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    deleteVessel: async (id) => {
        try {
            const { error } = await supabase.from('vessels').delete().eq('id', id);
            if (error) throw error;
            set(state => ({ vessels: state.vessels.filter(v => v.id !== id) }));
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    /**
     * Load historical positions from Supabase tracking table.
     */
    loadHistoricalPositions: async (visibleVessels = []) => {
        if (!visibleVessels.length) return;
        
        const visibleIds = visibleVessels.map(v => v.id);
        
        let query = supabase
            .from('vessel_tracking')
            .select('vessel_id, mmsi, lat, lon, speed, heading, status, timestamp')
            .order('timestamp', { ascending: false })
            .limit(200);

        if (visibleIds.length > 0) {
            query = query.in('vessel_id', visibleIds);
        }

        const { data, error } = await query;
        if (error || !data) return;

        const positions = visibleVessels.map(v => {
            const track = data.find(t => 
                t.vessel_id === v.id || 
                String(t.mmsi) === String(v.mmsi)
            );
            return {
                vessel: v.name,
                vesselId: v.id,
                lat: track?.lat || 0,
                lon: track?.lon || 0,
                speed: track?.speed || 0,
                heading: track?.heading || 0,
                status: track?.status || 'unknown',
                lastUpdate: track?.timestamp || null
            };
        });
        
        set({ vesselPositions: positions });
    },

    /**
     * Overlay Datalastic live data onto the current positions.
     */
    updateLivePositions: (livePositions) => {
        const { vessels, vesselPositions } = get();
        if (!livePositions || !vessels.length || !vesselPositions.length) return;

        // Optimized lookup
        const vesselsByName = new Map();
        vessels.forEach(v => { if (v.name) vesselsByName.set(v.name, v); });

        let hasChanges = false;
        const newPositions = vesselPositions.map(pos => {
            const v = vesselsByName.get(pos.vessel);
            if (!v?.mmsi) return pos;
            
            const live = livePositions[v.mmsi];
            if (!live) return pos;

            if (pos.lat === live.lat && pos.lon === live.lon && pos.speed === live.speed && pos.heading === live.course) {
                return pos;
            }
            
            hasChanges = true;
            return {
                ...pos,
                lat: live.lat || pos.lat,
                lon: live.lon || pos.lon,
                speed: live.speed ?? pos.speed,
                heading: live.course ?? pos.heading,
                status: live.status || pos.status,
                lastUpdate: new Date()
            };
        });

        if (hasChanges) set({ vesselPositions: newPositions });
    }
}));
