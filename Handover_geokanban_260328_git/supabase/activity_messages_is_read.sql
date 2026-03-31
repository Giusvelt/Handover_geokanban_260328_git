-- Add is_read flag to activity_messages for correct notification counting
ALTER TABLE activity_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Update existing messages to be read so we don't trigger false notifications
UPDATE activity_messages SET is_read = true WHERE is_read IS FALSE;
