// @ts-nocheck
// GK_V3 — Unified Vessel Position + Geofence Check Edge Function
// This function:
// 1. Fetches live vessel positions from Datalastic API
// 2. Saves weather data from Open-Meteo
// 3. Saves position to vessel_tracking
// 4. Checks position against ALL polygon geofences
// 5. Creates ENTER/EXIT events when transitions are detected

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Point-in-Polygon (Ray Casting) ─────────────────────────────────
function isPointInPolygon(lat: number, lon: number, polygon: number[][]): boolean {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const [latI, lonI] = polygon[i];
        const [latJ, lonJ] = polygon[j];
        const intersects = ((lonI > lon) !== (lonJ > lon)) &&
            (lat < ((latJ - latI) * (lon - lonI)) / (lonJ - lonI) + latI);
        if (intersects) inside = !inside;
    }
    return inside;
}

// ─── Parse polygon coords from DB ───────────────────────────────────
function parsePolygon(raw: any): number[][] | null {
    try {
        const coords = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(coords) && coords.length >= 3) return coords;
    } catch { /* skip */ }
    return null;
}

console.log('🚢 GK_V3 — Unified Position + Geofence Engine')

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // ─── 1. Initialize Supabase (Service Role = bypass RLS) ──────
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // ─── 2. Get API Key ──────────────────────────────────────────
        const DATALASTIC_API_KEY = Deno.env.get('DATALASTIC_API_KEY');
        if (!DATALASTIC_API_KEY) throw new Error('Missing DATALASTIC_API_KEY');

        // ─── 3. Load vessels + geofences ─────────────────────────────
        const [vesselsRes, geofencesRes] = await Promise.all([
            supabaseClient.from('vessels').select('mmsi, id, name'),
            supabaseClient.from('geofences').select('id, name, nature, polygon_coords')
        ]);

        if (vesselsRes.error) throw vesselsRes.error;
        const vessels = vesselsRes.data || [];
        if (vessels.length === 0) {
            return new Response(JSON.stringify({ message: 'No vessels found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
            })
        }

        // Parse geofence polygons once
        const geofences = (geofencesRes.data || []).map(g => ({
            ...g,
            coords: parsePolygon(g.polygon_coords)
        })).filter(g => g.coords !== null);

        // Load current geofence status memory
        const { data: statusMemory } = await supabaseClient
            .from('vessel_geofence_status')
            .select('*');
        const statusMap = new Map(
            (statusMemory || []).map(s => [`${s.vessel_id}:${s.geofence_id}`, s])
        );

        const results = [];
        const errors = [];
        let geofenceEventsCreated = 0;

        // ─── 4. Process each vessel ──────────────────────────────────
        for (const vessel of vessels) {
            try {
                if (!vessel.mmsi) continue;

                // ─── 4.1 Fetch position from Datalastic ─────────────
                let positionData = null;
                let attempt = 0;
                while (attempt < 3 && !positionData) {
                    try {
                        const response = await fetch(
                            `https://api.datalastic.com/api/v0/vessel?mmsi=${vessel.mmsi}`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${DATALASTIC_API_KEY}`,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );
                        if (response.ok) {
                            const json = await response.json();
                            if (json.data) {
                                positionData = Array.isArray(json.data)
                                    ? json.data[0]
                                    : (typeof json.data === 'object' ? json.data : null);
                            } else break;
                        } else throw new Error(`HTTP ${response.status}`);
                    } catch (e) {
                        console.warn(`Attempt ${attempt + 1} failed for ${vessel.mmsi}: ${e.message}`);
                        attempt++;
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }

                if (!positionData) {
                    errors.push({ mmsi: vessel.mmsi, error: 'No data' });
                    continue;
                }

                const lat = positionData.lat;
                const lon = positionData.lon;
                const speed = positionData.speed || 0;

                // ─── 4.2 Fetch & save weather ────────────────────────
                try {
                    const [wRes, tRes] = await Promise.all([
                        fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wind_speed_10m,wind_direction_10m&timezone=UTC`),
                        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`)
                    ]);
                    if (wRes.ok && tRes.ok) {
                        const wJson = await wRes.json();
                        const tJson = await tRes.json();
                        await supabaseClient.from('weather_logs').insert({
                            location_name: `Vessel: ${vessel.mmsi}`,
                            lat, lon,
                            wave_height: wJson.current?.wave_height,
                            wind_speed: wJson.current?.wind_speed_10m,
                            wind_direction: wJson.current?.wind_direction_10m,
                            temperature: tJson.current?.temperature_2m,
                            weather_code: tJson.current?.weather_code || 0,
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch (wErr) {
                    console.warn(`Weather fetch failed for ${vessel.mmsi}:`, wErr.message);
                }

                // ─── 4.3 Check for duplicate position ────────────────
                const { data: lastEntry } = await supabaseClient
                    .from('vessel_tracking')
                    .select('timestamp')
                    .eq('vessel_id', vessel.id)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const newTimestamp = new Date(positionData.timestamp || Date.now()).toISOString();
                if (lastEntry) {
                    const diff = Math.abs(new Date(newTimestamp).getTime() - new Date(lastEntry.timestamp).getTime());
                    if (diff < 1000) {
                        results.push({ mmsi: vessel.mmsi, status: 'skipped_duplicate' });
                        continue;
                    }
                }

                // ─── 4.4 Save position ───────────────────────────────
                const { error: insertError } = await supabaseClient
                    .from('vessel_tracking')
                    .insert({
                        vessel_id: vessel.id,
                        mmsi: vessel.mmsi,
                        lat, lon,
                        speed: speed,
                        heading: positionData.course,
                        status: speed > 0.5 ? 'underway' : 'anchored',
                        timestamp: newTimestamp,
                        raw_data: positionData
                    });

                if (insertError) {
                    errors.push({ mmsi: vessel.mmsi, error: insertError.message });
                    continue;
                }

                // ═══════════════════════════════════════════════════════
                // ─── 4.5 GEOFENCE CHECK — The core tracking logic ────
                // ═══════════════════════════════════════════════════════
                const now = new Date().toISOString();

                for (const geo of geofences) {
                    const currentlyInside = isPointInPolygon(lat, lon, geo.coords!);
                    const newStatus = currentlyInside ? 'INSIDE' : 'OUTSIDE';

                    // Get previous status from memory
                    const key = `${vessel.id}:${geo.id}`;
                    const prev = statusMap.get(key);
                    const prevStatus = prev?.status || 'OUTSIDE';

                    // Detect transition
                    if (newStatus !== prevStatus) {
                        const eventType = currentlyInside ? 'ENTER' : 'EXIT';

                        console.log(`🔔 ${vessel.name}: ${eventType} ${geo.name} [${geo.nature}]`);

                        // Create geofence event
                        const { error: evtErr } = await supabaseClient
                            .from('geofence_events')
                            .insert({
                                vessel_id: vessel.id,
                                geofence_id: geo.id,
                                event_type: eventType,
                                timestamp: now,
                                confidence_score: 1.0,
                                processed: false
                            });

                        if (!evtErr) {
                            geofenceEventsCreated++;

                            // ─── 4.5.1 Trip Counter Logic (Added for Production Targets) ───
                            if (eventType === 'ENTER' && geo.nature === 'unloading_site') {
                                // Debounce: check logs for same vessel last 12 hours
                                const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
                                const { data: recentLogs } = await supabaseClient
                                    .from('production_plans_logs')
                                    .select('id')
                                    .eq('vessel_id', vessel.id)
                                    .eq('action', 'trip_increment')
                                    .gt('created_at', twelveHoursAgo);

                                if (!recentLogs || recentLogs.length === 0) {
                                    // Find active plan (matching en-GB localization used in UI)
                                    const currentPeriod = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' });
                                    const { data: plan } = await supabaseClient
                                        .from('production_plans')
                                        .select('id, actual_trips, actual_quantity')
                                        .eq('vessel_id', vessel.id)
                                        .eq('period_name', currentPeriod)
                                        .eq('status', 'active')
                                        .order('created_at', { ascending: false })
                                        .limit(1)
                                        .maybeSingle();

                                    if (plan) {
                                        // Get vessel avg_cargo
                                        const { data: vData } = await supabaseClient
                                            .from('vessels')
                                            .select('avg_cargo')
                                            .eq('id', vessel.id)
                                            .single();

                                        const avgCargo = vData?.avg_cargo || 0;
                                        const newTrips = (plan.actual_trips || 0) + 1;

                                        // Recalculate actual_quantity = trips × avg_cargo (NEVER +=)
                                        await supabaseClient
                                            .from('production_plans')
                                            .update({
                                                actual_trips: newTrips,
                                                actual_quantity: newTrips * avgCargo,
                                                updated_at: now
                                            })
                                            .eq('id', plan.id);

                                        // Log it
                                        await supabaseClient.from('production_plans_logs').insert({
                                            vessel_id: vessel.id,
                                            action: 'trip_increment',
                                            created_at: now
                                        });

                                        console.log(`📈 TRIP COUNTED for ${vessel.name}: trip #${newTrips}, total ${newTrips * avgCargo} tons`);
                                    }
                                }
                            }
                        } else {
                            console.error(`Event insert error: ${evtErr.message}`);
                        }
                    }

                    // Update status memory (always, even if no transition)
                    await supabaseClient
                        .from('vessel_geofence_status')
                        .upsert({
                            vessel_id: vessel.id,
                            geofence_id: geo.id,
                            status: newStatus,
                            last_check_at: now,
                            ...(newStatus !== prevStatus ? { last_transition_at: now } : {})
                        }, { onConflict: 'vessel_id,geofence_id' });

                    // Update local map for next vessel iteration
                    statusMap.set(key, { vessel_id: vessel.id, geofence_id: geo.id, status: newStatus });
                }
                // ═══════════════════════════════════════════════════════

                results.push({ mmsi: vessel.mmsi, name: vessel.name, status: 'saved', lat, lon });

            } catch (innerErr) {
                console.error(`Process Error for ${vessel.mmsi}:`, innerErr);
                errors.push({ mmsi: vessel.mmsi, error: innerErr.message });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            processed: results.length,
            geofence_events_created: geofenceEventsCreated,
            errors,
            results
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
