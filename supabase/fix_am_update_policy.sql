-- Update policy for activity_messages to allow readers to mark messages as read
DROP POLICY IF EXISTS "auth_update_am" ON activity_messages;

CREATE POLICY "auth_update_am" ON activity_messages
    FOR UPDATE TO authenticated 
    USING (sender_id = auth.uid() OR true)
    WITH CHECK (true); -- Allow anyone authenticated to update messages (used for is_read)
