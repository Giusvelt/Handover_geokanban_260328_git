-- Migration: Standardize Companies and Link Vessels
-- Data: 2026-03-20
-- Autore: GeoKanban

-- 1. Extend Companies table with full business details
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS vat_number TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tax_code TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Italy';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_supplier BOOLEAN DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_shipowner BOOLEAN DEFAULT true;

-- 2. Ensure vessels table has company_id link
ALTER TABLE public.vessels ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- 3. Comments for documentation
COMMENT ON TABLE public.companies IS 'Master data for companies, suppliers, and shipowners';
COMMENT ON COLUMN public.companies.vat_number IS 'Partita IVA';
COMMENT ON COLUMN public.vessels.company_id IS 'Link to the owning company (Armatore)';
