-- ==========================================================
-- SCRIPT DI IMPORTAZIONE MASSIVA UTENTI CREW (NOVAMARINE)
-- ==========================================================
-- Esegui questo script nell'SQL Editor di Supabase.

DO $$
DECLARE
    target_company_id UUID;
    rec RECORD;
    v_mmsi TEXT;
    v_user_id UUID;
    
    -- Impostiamo una password standard per tutte le navi che poi potranno cambiare 
    -- (La password criptata equivale a "Novamarine2026!")
    d_password TEXT := crypt('Novamarine2026!', gen_salt('bf'));
BEGIN
    -- 1. Trova o crea la compagnia "novamarineCARRIERS"
    SELECT id INTO target_company_id FROM companies WHERE name ILIKE 'novamarineCARRIERS' LIMIT 1;
    IF target_company_id IS NULL THEN
        INSERT INTO companies (name, code) VALUES ('novamarineCARRIERS', 'NOVAMARINE') RETURNING id INTO target_company_id;
    END IF;

    -- 2. Creiamo un loop per inserire automaticamente i datiAuth
    FOR rec IN 
        SELECT * FROM (
            VALUES 
            ('Siderorion@SkyFile.com', 'SIDER ORION', 'crew'),
            ('Siderrebecca@SkyFile.com', 'SIDER REBECCA', 'crew'),
            ('Siderrodi@SkyFile.com', 'SIDER RODI', 'crew'),
            ('Master.Siderbear@SkyFile.com', 'SIDER BEAR', 'crew'),
            ('Siderabidjan@SkyFile.com', 'SIDER ABIDJAN', 'crew'),
            ('Sidersonja@SkyFile.com', 'SIDER SONJA', 'crew'),
            ('Siderbuffalo@SkyFile.com', 'SIDER BUFFALO', 'crew'),
            ('Indovinogenoabreakwater@novamarinecarriers.com', 'Crew Admin Novamarine', 'crew_admin')
        ) AS t(email, name, role)
    LOOP
        -- Cerchiamo in automatico l'mmsi della nave se è già archiviata in anagrafica vessels (ma solo per logiche crew)
        v_mmsi := NULL;
        IF rec.role = 'crew' THEN
            SELECT mmsi INTO v_mmsi FROM vessels WHERE name ILIKE '%' || rec.name || '%' LIMIT 1;
        END IF;
        
        -- Controlliamo se auth.users ha già questa email protetta
        SELECT id INTO v_user_id FROM auth.users WHERE email = lower(rec.email);
        
        IF v_user_id IS NULL THEN
            -- L'utente non esiste, lo generiamo ex-novo bypassando i blocchi di e-mail confirmation!
            v_user_id := gen_random_uuid();
            
            INSERT INTO auth.users (
                id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
                raw_app_meta_data, raw_user_meta_data, created_at, updated_at
            ) VALUES (
                v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
                lower(rec.email), d_password, NOW(), 
                '{"provider": "email", "providers": ["email"]}', 
                json_build_object('name', rec.name, 'role', rec.role), 
                NOW(), NOW()
            );
        END IF;

        -- Inseriamo/Aggiorniamo direttamente il record in user_profiles
        -- Così siamo certi che esista, nel caso il trigger di Supabase fosse in ritardo o mancante
        INSERT INTO user_profiles (id, email, display_name, role, company_id, mmsi)
        VALUES (v_user_id, lower(rec.email), rec.name, rec.role, target_company_id, v_mmsi)
        ON CONFLICT (id) DO UPDATE SET
            company_id = EXCLUDED.company_id,
            mmsi = EXCLUDED.mmsi,
            role = EXCLUDED.role,
            display_name = EXCLUDED.display_name;

    END LOOP;
END;
$$ LANGUAGE plpgsql;
