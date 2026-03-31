-- Migration: Fix Activity Chat Permissions
-- Data: 2026-03-29
-- Autore: GeoKanban

-- 1. Create table if not exists (safety check to ensure table matches frontend expectations)
CREATE TABLE IF NOT EXISTS activity_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_activity_id UUID REFERENCES vessel_activity(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),
    sender_role TEXT,
    message_text TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS (Row Level Security)
ALTER TABLE activity_messages ENABLE ROW LEVEL SECURITY;

-- 3. Cleanup existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated read messages" ON activity_messages;
DROP POLICY IF EXISTS "Allow authenticated insert messages" ON activity_messages;
DROP POLICY IF EXISTS "Allow authenticated update status" ON activity_messages;

-- 4. Create Security Policies
-- SELECT: Allow all authenticated users to read messages
CREATE POLICY "Allow authenticated read messages" ON activity_messages
FOR SELECT TO authenticated USING (true);

-- INSERT: Allow authenticated users to send messages (linked to their auth.uid)
CREATE POLICY "Allow authenticated insert messages" ON activity_messages
FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- UPDATE: Allow authenticated users to mark messages as read
CREATE POLICY "Allow authenticated update status" ON activity_messages
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 5. Performance Index
CREATE INDEX IF NOT EXISTS idx_activity_messages_vessel_activity_id ON activity_messages(vessel_activity_id);

-- 6. Add comment for documentation
COMMENT ON TABLE activity_messages IS 'Internal chat for specific vessel activities - GeoKanban v3'; info
