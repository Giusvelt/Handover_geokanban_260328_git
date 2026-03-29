-- ═══════════════════════════════════════════════════════════════
-- Create Crew User for ANNAMARIA Z
-- Email: veromidollo@gmail.com
-- ═══════════════════════════════════════════════════════════════

-- Fix: allow admin to insert/manage profiles for any user
DROP POLICY IF EXISTS "Insert own profile" ON user_profiles;
CREATE POLICY "Authenticated can insert profiles" ON user_profiles
    FOR INSERT TO authenticated WITH CHECK (true);

-- Create the crew profile (the user must first be signed up via Auth)
-- Step 1: You need to sign up veromidollo@gmail.com from the app login page
--         with password: crew2026!
-- Step 2: Then run this to assign the profile

-- This will work AFTER the user has signed up:
INSERT INTO user_profiles (id, email, display_name, role, vessel_id, is_active)
SELECT 
    u.id,
    u.email,
    'Crew ANNAMARIA Z',
    'crew',
    (SELECT id FROM vessels WHERE name = 'ANNAMARIA Z'),
    true
FROM auth.users u
WHERE u.email = 'veromidollo@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'crew',
    vessel_id = (SELECT id FROM vessels WHERE name = 'ANNAMARIA Z'),
    display_name = 'Crew ANNAMARIA Z';
