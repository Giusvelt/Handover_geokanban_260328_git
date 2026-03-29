// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =====================================================
// POINT-IN-POLYGON - Ray Casting Algorithm
// Verifica se un punto (lat, lon) è dentro il poligono.
// =====================================================
function isPointInPolygon(vesselLat, vesselLon, polygon) {
    const lon = vesselLon + 1e-10;
    const lat = vesselLat;
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
        const [latI, lonI] = polygon[i];
        const [latJ, lonJ] = polygon[j];

        const intersect =
            (lonI > lon) !== (lonJ > lon) &&
            lat < ((latJ - latI) * (lon - lonI)) / (lonJ - lonI) + latI;

        if (intersect) inside = !inside;
    }

    return inside;
}

function checkVesselInGeofence(vesselLat, vesselLon, geofence) {
    if (!geofence.polygon_coords) return null;

    try {
        const coords = typeof geofence.polygon_coords === 'string'
            ? JSON.parse(geofence.polygon_coords)
            : geofence.polygon_coords;

        if (Array.isArray(coords) && coords.length >= 3) {
            return isPointInPolygon(vesselLat, vesselLon, coords);
        }
        return null;
    } catch (e) {
        console.warn(`⚠️ Error parsing polygon_coords for "${geofence.name}":`, e.message);
        return null;
    }
}

// =====================================================
// MAIN HANDLER (Task-Driven Logic)
// =====================================================
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const results = {
        checked: 0,
        skipped_no_polygon: 0,
        entries: 0,
        exits: 0,
        milestones_updated: 0,
        recovered: 0,
        errors: []
    };

    const urlParams = new URL(req.url).searchParams;
    const isRecovery = urlParams.get('action') === 'recover';

    try {
        if (isRecovery) {
            console.log("🕯️ RECOVERY MODE: Seeding Geofence Memory...");
            const { data: vList } = await supabase.from('vessels').select('id, mmsi, name');
            const { data: gList } = await supabase.from('geofences').select('id, name, lat, lon, polygon_coords');

            for (const v of vList || []) {
                const { data: lastP } = await supabase.from('vessel_tracking').select('lat, lon').eq('vessel_id', v.id).order('timestamp', { ascending: false }).limit(1);
                if (!lastP || lastP.length === 0) continue;
                const { lat, lon } = lastP[0];

                for (const g of gList || []) {
                    const isInside = checkVesselInGeofence(lat, lon, g);
                    if (isInside === null) continue;

                    await supabase.from('vessel_geofence_status').upsert({
                        vessel_id: v.id,
                        geofence_id: g.id,
                        status: isInside ? 'inside' : 'outside',
                        last_check_at: new Date().toISOString(),
                        last_transition_at: new Date().toISOString()
                    }, { onConflict: 'vessel_id,geofence_id' });
                    results.recovered++;
                }
            }
            return new Response(JSON.stringify({ success: true, recovered: results.recovered }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // STEP 1: Load all existing geofences
        const { data: geofences, error: geoError } = await supabase
            .from('geofences')
            .select('id, name, polygon_coords');
        if (geoError) throw geoError;

        const geofenceMap = new Map();
        for (const g of geofences) geofenceMap.set(g.id, g);

        // STEP 2: Load Active Milestones for cross-referencing
        const { data: activeMilestones, error: msError } = await supabase
            .from('milestones')
            .select('id, vessel_id, geofence_from_id, geofence_to_id, activity, status')
            .in('status', ['pending', 'in-progress']);
        if (msError) throw msError;

        const vesselTasks = new Map();
        if (activeMilestones) {
            for (const m of activeMilestones) {
                if (!vesselTasks.has(m.vessel_id)) vesselTasks.set(m.vessel_id, []);
                vesselTasks.get(m.vessel_id).push(m);
            }
        }

        // STEP 3: Load ALL vessels
        const { data: vessels, error: vesselError } = await supabase
            .from('vessels')
            .select('id, mmsi, name');
        if (vesselError) throw vesselError;

        console.log(`📡 MONITORING: ${vessels.length} vessels vs ${geofences.length} geofences`);

        // STEP 4: Load current status memory
        const { data: currentStatuses, error: statusError } = await supabase
            .from('vessel_geofence_status')
            .select('vessel_id, geofence_id, status');

        const statusMap = new Map();
        if (currentStatuses) {
            for (const s of currentStatuses) {
                statusMap.set(`${s.vessel_id}:${s.geofence_id}`, s.status?.toLowerCase() || 'outside');
            }
        }

        // STEP 5: Process Every Vessel
        for (const vessel of vessels) {
            // Get latest tracking point
            const { data: positions, error: posError } = await supabase
                .from('vessel_tracking')
                .select('lat, lon, timestamp')
                .eq('vessel_id', vessel.id)
                .order('timestamp', { ascending: false })
                .limit(1);

            if (posError || !positions || positions.length === 0) continue;

            const { lat, lon } = positions[0];
            const now = new Date().toISOString();

            // Geofences that could be relevant to milestones for THIS vessel
            const tasks = vesselTasks.get(vessel.id) || [];

            // Check against ALL geofences
            for (const geo of geofences) {
                const insideResult = checkVesselInGeofence(lat, lon, geo);
                if (insideResult === null) continue;

                results.checked++;
                const key = `${vessel.id}:${geo.id}`;
                const hasHistory = statusMap.has(key);
                const previousStatus = hasHistory ? statusMap.get(key) : 'outside'; // Fallback only for type, logic uses hasHistory
                const newStatus = insideResult ? 'inside' : 'outside';

                // CASO 0: Prima volta che controlliamo questa coppia (Init)
                if (!hasHistory) {
                    // Se la nave è già dentro, NON scatenare evento ENTER (evita false start)
                    // Semplicemente salviamo lo stato attuale.
                    await supabase
                        .from('vessel_geofence_status')
                        .upsert({
                            vessel_id: vessel.id,
                            geofence_id: geo.id,
                            status: newStatus,
                            last_check_at: now
                        }, { onConflict: 'vessel_id,geofence_id' });
                    continue;
                }

                // CASO 1: Nessun cambiamento
                if (previousStatus === newStatus) {
                    await supabase
                        .from('vessel_geofence_status')
                        .upsert({
                            vessel_id: vessel.id,
                            geofence_id: geo.id,
                            status: newStatus,
                            last_check_at: now
                        }, { onConflict: 'vessel_id,geofence_id' });
                    continue;
                }

                // CAMBIO DI STATO!
                const eventType = insideResult ? 'ENTER' : 'EXIT';
                console.log(`🚨 ${vessel.name} ${eventType} "${geo.name}"`);

                if (insideResult) results.entries++;
                else results.exits++;

                // 1. Registra evento
                await supabase.from('geofence_events').insert({
                    vessel_id: vessel.id,
                    geofence_id: geo.id,
                    event_type: eventType,
                    timestamp: now,
                    confidence_score: 1.0,
                    processed: false
                });

                // 2. Aggiorna Milestone
                const relatedMilestones = tasks.filter(m =>
                    m.geofence_from_id === geo.id || m.geofence_to_id === geo.id
                );

                for (const m of relatedMilestones) {
                    let update = {};
                    const isNavigation = m.geofence_from_id !== m.geofence_to_id; // Staffetta Logic (A -> B)
                    const isLocalWork = m.geofence_from_id === m.geofence_to_id;    // Operation Logic (B -> B)

                    // --- TEMPORAL VALIDATION (24h Window) ---
                    const plannedStart = new Date(m.planned_entry || m.plannedEntry).getTime();
                    const plannedEnd = new Date(m.planned_exit || m.plannedExit).getTime();
                    const timeWindowStart = Date.now() - (24 * 60 * 60 * 1000); // -24h
                    const timeWindowEnd = Date.now() + (24 * 60 * 60 * 1000);   // +24h
                    const isWithinTemporalWindow = plannedStart <= timeWindowEnd && plannedEnd >= timeWindowStart;

                    if (!isWithinTemporalWindow) continue; // Skip if out of time window

                    // --- REFINED LOGIC (The "Staffetta") ---

                    if (isNavigation) {
                        // CASE A: Navigation (A -> B)
                        // Trigger 1: EXIT from 'From' -> Start Navigation
                        if (eventType === 'EXIT' && m.geofence_from_id === geo.id && m.status === 'pending') {
                            update = { status: 'in-progress', actual_entry: now };
                            console.log(`🚢 START NAV: ${vessel.name} left ${geo.name}`);
                        }
                        // Trigger 2: ENTER in 'To' -> Complete Navigation (Staffetta Point)
                        else if (eventType === 'ENTER' && m.geofence_to_id === geo.id && m.status === 'in-progress') {
                            update = { status: 'completed', actual_exit: now };
                            console.log(`🏁 FINISH NAV: ${vessel.name} arrived at ${geo.name}`);
                        }
                    }
                    else if (isLocalWork) {
                        // CASE B: Work/Stay (B -> B)
                        // Trigger 1: ENTER in 'From' -> Start Work (Staffetta Point)
                        if (eventType === 'ENTER' && m.geofence_from_id === geo.id && m.status === 'pending') {
                            update = { status: 'in-progress', actual_entry: now };
                            console.log(`🛠️ START WORK: ${vessel.name} entered ${geo.name}`);
                        }
                        // Trigger 2: EXIT from 'From' -> Complete Work
                        else if (eventType === 'EXIT' && m.geofence_from_id === geo.id && m.status === 'in-progress') {
                            update = { status: 'completed', actual_exit: now };
                            console.log(`✅ FINISH WORK: ${vessel.name} left ${geo.name}`);
                        }
                    }

                    if (Object.keys(update).length > 0) {
                        const { error: upErr } = await supabase
                            .from('milestones')
                            .update(update)
                            .eq('id', m.id);

                        if (upErr) results.errors.push(upErr.message);
                        else results.milestones_updated++;
                    }
                }

                // 3. Aggiorna Memoria (vessel_geofence_status)
                await supabase
                    .from('vessel_geofence_status')
                    .upsert({
                        vessel_id: vessel.id,
                        geofence_id: geo.id,
                        status: newStatus,
                        last_check_at: now,
                        last_transition_at: now
                    }, { onConflict: 'vessel_id,geofence_id' });
            }
        }

        console.log(`✅ CHECK DONE: ${results.entries} IN, ${results.exits} OUT`);
        return new Response(
            JSON.stringify({ success: true, ...results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('❌ ERROR:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
