-- GK_V3: Fix RLS policies for tracking tables
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/voeuvmjbaqvvwfnivkvz/sql

-- 1. vessel_geofence_status: Allow all operations for authenticated users
ALTER TABLE vessel_geofence_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON vessel_geofence_status;
CREATE POLICY "Allow all for authenticated" ON vessel_geofence_status
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON vessel_geofence_status;
CREATE POLICY "Allow all for service role" ON vessel_geofence_status
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. geofence_events: Allow all operations
ALTER TABLE geofence_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON geofence_events;
CREATE POLICY "Allow all for authenticated" ON geofence_events
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON geofence_events;
CREATE POLICY "Allow all for service role" ON geofence_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. vessel_tracking: Ensure read access for app
ALTER TABLE vessel_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for authenticated" ON vessel_tracking;
CREATE POLICY "Allow read for authenticated" ON vessel_tracking
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all for service role" ON vessel_tracking;
CREATE POLICY "Allow all for service role" ON vessel_tracking
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. production_plans: Allow all operations for authenticated users
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON production_plans;
CREATE POLICY "Allow all for authenticated" ON production_plans
    FOR ALL USING (true) WITH CHECK (true);
