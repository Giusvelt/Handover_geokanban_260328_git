import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useProductionPlans() {
    const [plans, setPlans] = useState([]);

    const fetchPlans = useCallback(async () => {
        const { data, error } = await supabase
            .from('production_plans')
            .select('*')
            .order('period_name');
        if (!error && data) setPlans(data);
    }, []);

    const upsertPlan = async (plan) => {
        // Check if plan exists for this vessel + period
        const existing = plans.find(p => p.vessel_id === plan.vessel_id && p.period_name === plan.period_name);

        if (existing) {
            const { error } = await supabase
                .from('production_plans')
                .update({
                    target_trips: plan.target_trips,
                    actual_trips: plan.actual_trips || existing.actual_trips || 0,
                    target_quantity: plan.target_quantity,
                    actual_quantity: plan.actual_quantity || existing.actual_quantity || 0,
                    status: 'active'
                })
                .eq('id', existing.id);
            if (!error) await fetchPlans();
            return { success: !error };
        } else {
            const { error } = await supabase
                .from('production_plans')
                .insert([{ ...plan, status: 'active' }]);
            if (!error) await fetchPlans();
            return { success: !error };
        }
    };

    const deletePlan = async (vesselId, periodName) => {
        const { error } = await supabase
            .from('production_plans')
            .delete()
            .eq('vessel_id', vesselId)
            .eq('period_name', periodName);
        if (!error) await fetchPlans();
    };

    useEffect(() => { fetchPlans(); }, [fetchPlans]);

    return { plans, fetchPlans, upsertPlan, deletePlan };
}
