-- Migration: Add company_id to vessels
-- Data: 2026-03-20
-- Autore: GeoKanban

-- 1. Modifica struttura tabella
ALTER TABLE public.vessels ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- 2. Commento descrittivo sulla colonna
COMMENT ON COLUMN public.vessels.company_id IS 'ID della compagnia armatoriale a cui appartiene la nave';
