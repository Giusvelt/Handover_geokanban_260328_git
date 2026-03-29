// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('Hello from fetch-weather-logs!')

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization') } } }
        )

        // 1. Identify Locations to Monitor
        // For now, let's hardcode Genoa Port or fetch active sites/geofences from DB.
        // Fetching distinct geofence "families" or just one central point for now.
        // Let's assume we want weather for "Genoa" (Lat 44.406, Lon 8.933)
        // In a real app, we might loop through active project locations.
        const locations = [
            { name: 'Genoa Port', lat: 44.406, lon: 8.933 }
        ];

        const results = [];

        for (const loc of locations) {
            // 2. Fetch Weather from OpenMeteo (No API Key needed)
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wave_height&wind_speed_unit=kn`
            );

            if (!response.ok) {
                throw new Error(`OpenMeteo API Error: ${response.status}`);
            }

            const data = await response.json();
            const current = data.current;

            if (current) {
                // 3. Insert into DB
                const { error: insertError } = await supabaseClient
                    .from('weather_logs')
                    .insert({
                        location_name: loc.name,
                        lat: loc.lat,
                        lon: loc.lon,
                        temperature: current.temperature_2m,
                        wind_speed: current.wind_speed_10m,
                        wind_direction: current.wind_direction_10m, // Ensure DB has this column or map strictly
                        weather_code: current.weather_code,
                        wave_height: current.wave_height || 0, // OpenMeteo marine API might differ, standard forecast usage here.
                        timestamp: new Date()
                    });

                if (insertError) {
                    console.error(`DB Insert Error for ${loc.name}:`, insertError);
                } else {
                    results.push({ location: loc.name, status: 'saved' });
                }
            }
        }

        return new Response(JSON.stringify({ success: true, processed: results }), {
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
