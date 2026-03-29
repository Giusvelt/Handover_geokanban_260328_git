import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { can } from '../lib/permissions';

/**
 * useUserProfile V2 — Supporta i 4 ruoli:
 * crew, crew_admin, operation, operation_admin
 * Aggiunge: company_id, mmsi, is_blocked, last_seen_at
 */
export function useUserProfile() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadProfile = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data, error } = await supabase
            .from('user_profiles')
            .select('*, vessels(name, mmsi), companies(name, code)')
            .eq('id', user.id)
            .maybeSingle();

        if (data) {
            const role = data.role || 'crew';
            setProfile({
                id:           data.id,
                email:        data.email,
                displayName:  data.display_name,
                role,
                // Applica gli overrides salvati nel DB
                permissions:  can(role, data.custom_overrides || {}),
                custom_overrides: data.custom_overrides || {},

                // Nave: Ora l'unica verità è il campo MMSI, ma con fallback se assente (retrocompatibilità script)
                vesselId:     data.vessel_id,
                vesselName:   data.vessels?.name || null,
                mmsi:         data.mmsi || data.vessels?.mmsi || null, 

                // Compagnia
                companyId:    data.company_id,
                companyName:  data.companies?.name || null,

                phoneNumber:  data.phone_number,
                isActive:     data.is_active,
                isBlocked:    data.is_blocked || false,
            });
        } else {
            // Fallback: nessun profilo trovato → operation_admin di emergenza
            setProfile({
                id:           user.id,
                email:        user.email,
                displayName:  user.user_metadata?.name || user.email,
                role:         'operation_admin',
                permissions:  can('operation_admin'),
                vesselId:     null,
                vesselName:   null,
                mmsi:         null,
                companyId:    null,
                companyName:  null,
                phoneNumber:  null,
                isActive:     true,
                isBlocked:    false,
            });
        }
        setLoading(false);
    }, []);

    const updateProfile = async (updates) => {
        if (!profile) return;

        const payload = {};
        if (updates.displayName !== undefined)  payload.display_name  = updates.displayName;
        if (updates.companyName !== undefined)  payload.company_name  = updates.companyName;
        if (updates.phoneNumber !== undefined)  payload.phone_number  = updates.phoneNumber;
        if (updates.mmsi        !== undefined)  payload.mmsi          = updates.mmsi;
        if (updates.companyId   !== undefined)  payload.company_id    = updates.companyId;

        const { error } = await supabase
            .from('user_profiles')
            .update(payload)
            .eq('id', profile.id);

        if (!error) await loadProfile();
        return { error };
    };

    // Heartbeat: aggiorna last_seen_at ogni 60s (per status online/offline)
    useEffect(() => {
        if (!profile?.id) return;

        const updateHeartbeat = async () => {
            await supabase
                .from('user_profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', profile.id);
        };

        updateHeartbeat(); // subito al mount
        const interval = setInterval(updateHeartbeat, 60_000);

        return () => clearInterval(interval);
    }, [profile?.id]);

    // Controlla is_blocked ogni 30s — se bloccato, forza logout
    useEffect(() => {
        if (!profile?.id) return;

        const checkBlocked = async () => {
            const { data } = await supabase
                .from('user_profiles')
                .select('is_blocked')
                .eq('id', profile.id)
                .single();

            if (data?.is_blocked) {
                await supabase.auth.signOut();
                window.location.reload();
            }
        };

        const interval = setInterval(checkBlocked, 30_000);
        return () => clearInterval(interval);
    }, [profile?.id]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    return { profile, loading, updateProfile, reloadProfile: loadProfile };
}
