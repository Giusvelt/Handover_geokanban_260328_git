import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useUserProfile } from '../hooks/useUserProfile';
import { useGeofenceStore } from '../store/useGeofenceStore';
import { useVesselStore } from '../store/useVesselStore';
import { useActivityStore } from '../store/useActivityStore';
import { useConfigStore } from '../store/useConfigStore';
import { useDatalastic } from '../hooks/useDatalastic';

const DataContext = createContext();
export const useData = () => useContext(DataContext);

export function DataProvider({ children }) {
    const { profile } = useUserProfile();

    // Zustand store bindings
    const { 
        vessels, vesselPositions, loading: vesselsLoading, 
        fetchVessels, addVessel, updateVessel, deleteVessel,
        loadHistoricalPositions, updateLivePositions
    } = useVesselStore();

    const { 
        geofences, loading: geofencesLoading, 
        fetchGeofences, addGeofence, updateGeofence, deleteGeofence 
    } = useGeofenceStore();

    const { 
        activities, productionPlans, fleetKPIs, vesselKPIs, loading: activitiesLoading, lastUpdate,
        fetchActivities, upsertPlan, deletePlan, fetchPlans, fetchFleetKPIs, fetchVesselKPIs
    } = useActivityStore();

    const { 
        standbyReasons, schedules, 
        fetchReasons, fetchSchedules, upsertSchedule, deleteSchedule,
        addStandbyReason, updateStandbyReason, deleteStandbyReason 
    } = useConfigStore();

    const { positions: livePositions } = useDatalastic(vessels);

    const crewVesselId = useMemo(() => {
        if (!profile || !vessels?.length) return null;
        if (profile.role !== 'crew') return null;
        if (profile.mmsi) {
            const byMmsi = vessels.find(v => String(v.mmsi) === String(profile.mmsi));
            if (byMmsi) return byMmsi.id;
        }
        return null;
    }, [profile, vessels]);

    const companyVesselIds = useMemo(() => {
        if (!profile || !vessels?.length) return null;
        if (profile.role !== 'crew_admin') return null;
        if (!profile.companyId) return null;
        return vessels.filter(v => v.company_id === profile.companyId).map(v => v.id);
    }, [profile, vessels]);

    // Initial Master Data Fetching
    useEffect(() => {
        fetchVessels();
        fetchGeofences();
        fetchReasons();
        fetchSchedules();
        fetchPlans();
        fetchFleetKPIs();
        fetchVesselKPIs();
    }, [fetchVessels, fetchGeofences, fetchReasons, fetchSchedules, fetchPlans, fetchFleetKPIs, fetchVesselKPIs]);

    // Fetch activities
    useEffect(() => {
        if (!profile) return;
        if (profile.role === 'crew' && !crewVesselId) return;
        fetchActivities(profile.role === 'crew' ? crewVesselId : null, profile.role);
    }, [profile, crewVesselId, fetchActivities]);

    // Vessel Positions Logic
    useEffect(() => {
        if (!vessels?.length || !profile) return;

        let visibleVessels = vessels;
        if (profile.role === 'crew' && crewVesselId) {
            const crewVessel = vessels.find(v => v.id === crewVesselId);
            const crewCompanyId = crewVessel?.company_id || profile.companyId;
            visibleVessels = crewCompanyId
                ? vessels.filter(v => v.company_id === crewCompanyId)
                : [crewVessel].filter(Boolean);
        } else if (profile.role === 'crew_admin' && profile.companyId) {
            visibleVessels = vessels.filter(v => v.company_id === profile.companyId);
        }
        
        loadHistoricalPositions(visibleVessels);
        const interval = setInterval(() => {
            loadHistoricalPositions(visibleVessels);
        }, 5 * 60 * 1000);
        
        return () => clearInterval(interval);
    }, [vessels.length, crewVesselId, profile?.role, profile?.companyId, loadHistoricalPositions]);

    // Datalastic Overlay
    useEffect(() => {
        updateLivePositions(livePositions);
    }, [livePositions, updateLivePositions]);

    const value = useMemo(() => ({
        vessels, vesselPositions, geofences, activities, productionPlans,
        fleetKPIs, vesselKPIs,
        standbyReasons, schedules,
        profile, crewVesselId, companyVesselIds, lastUpdate,
        loading: vesselsLoading || geofencesLoading || activitiesLoading,
        fetchVessels, addVessel, updateVessel, deleteVessel,
        fetchGeofences, addGeofence, updateGeofence, deleteGeofence,
        fetchActivities,
        upsertPlan, deletePlan, fetchPlans,
        // useConfigStore explicitly named fetchReasons, but context expects fetchStandbyReasons
        fetchStandbyReasons: fetchReasons, 
        fetchSchedules, upsertSchedule, deleteSchedule,
        addStandbyReason, updateStandbyReason, deleteStandbyReason
    }), [
        vessels, vesselPositions, geofences, activities, productionPlans,
        fleetKPIs, vesselKPIs,
        standbyReasons, schedules, profile, crewVesselId, companyVesselIds, lastUpdate,
        vesselsLoading, geofencesLoading, activitiesLoading,
        fetchVessels, addVessel, updateVessel, deleteVessel,
        fetchGeofences, addGeofence, updateGeofence, deleteGeofence,
        fetchActivities, upsertPlan, deletePlan, fetchPlans,
        fetchReasons, fetchSchedules, upsertSchedule, deleteSchedule,
        addStandbyReason, updateStandbyReason, deleteStandbyReason
    ]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
