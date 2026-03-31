-- Migration: Fix Chat Role Constraint
-- Data: 2026-03-29
-- Autore: GeoKanban

-- 1. Rimuovo il vecchio vincolo restrittivo
ALTER TABLE activity_messages 
DROP CONSTRAINT IF EXISTS activity_messages_sender_role_check;

-- 2. Aggiungo il nuovo vincolo che include i ruoli moderni di GeoKanban
ALTER TABLE activity_messages 
ADD CONSTRAINT activity_messages_sender_role_check 
CHECK (sender_role IN ('admin', 'crew', 'operation_admin', 'crew_admin', 'operations'));

-- 3. Commento di verifica
COMMENT ON COLUMN activity_messages.sender_role IS 'Ruolo del mittente: admin, crew, operation_admin, o crew_admin';
