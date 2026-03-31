-- ==========================================
-- Fix Infinite Recursion in user_profiles RLS
-- ==========================================

-- 1. Create a SECURITY DEFINER function to read the user's role
-- bypassing RLS (otherwise reading user_profiles inside user_profiles policy causes infinite recursion)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    my_role TEXT;
BEGIN
    -- Query the table without triggering RLS because it's SECURITY DEFINER
    -- but wait, SECURITY DEFINER still checks RLS if row level security is enabled AND we don't bypass it.
    -- Wait, SECURITY DEFINER runs as the owner of the function (usually postgres).
    -- Thus it bypasses RLS for the tables owned by postgres. 
    -- Let's make sure!
    SELECT role INTO my_role FROM user_profiles WHERE id = auth.uid();
    RETURN my_role;
END;
$$;

-- 2. Drop the buggy policies
DROP POLICY IF EXISTS "Profile select policy" ON user_profiles;
DROP POLICY IF EXISTS "Profile update policy" ON user_profiles;

-- 3. Recreate policies utilizing the function
CREATE POLICY "Profile select policy" ON user_profiles
    FOR SELECT USING (
        id = auth.uid()
        OR get_my_role() IN ('operation', 'operation_admin')
    );

CREATE POLICY "Profile update policy" ON user_profiles
    FOR UPDATE USING (
        id = auth.uid()
        OR get_my_role() = 'operation_admin'
    );
