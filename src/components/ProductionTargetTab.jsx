import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Target, TrendingUp, Package, Edit2, Check, X, Ship, Trash2 } from 'lucide-react';
import SectionHeader from './SectionHeader';

export default function ProductionTargetTab() {
    const { vessels, productionPlans, upsertPlan, updateVessel, deleteVessel, vesselKPIs } = useData();

    const now = new Date();
    const currentPeriod = now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    const currentMonth = now.getMonth() + 1; // 1-12 for SQL matching
    const currentYear = now.getFullYear();

    // Fast-Lane: Estrazione immediata dalle View Materializzate PostgreSQL
    const actualTripsMap = {};
    let deliveredTotal = 0;

    (vesselKPIs || []).forEach(kpi => {
        if (kpi.month === currentMonth && kpi.year === currentYear) {
            actualTripsMap[kpi.vessel_id] = kpi.actual_trips || 0;
            // Se abbiamo certificato il logbook usiamo il tonnellaggio vero, altrimenti stima:
            deliveredTotal += (kpi.actual_quantity_certified > 0 ? kpi.actual_quantity_certified : kpi.actual_quantity_estimated || 0);
        }
    });

    const [summaryEdit, setSummaryEdit] = useState(null); 
    const [vesselEdits, setVesselEdits] = useState({});

    const globalPlan = (productionPlans || []).find(p => p.vessel_id === null && p.period_name === currentPeriod);

    const sumTargets = (productionPlans || [])
        .filter(p => p.period_name === currentPeriod && p.vessel_id !== null)
        .reduce((s, p) => s + (p.target_quantity || 0), 0);

    const totalTarget = summaryEdit !== null ? summaryEdit : (globalPlan?.target_quantity || sumTargets);
    const remainingTotal = Math.max(0, totalTarget - deliveredTotal);

    const handleSaveSummary = async () => {
        if (summaryEdit === null) return;
        try {
            const planPayload = {
                vessel_id: null,
                period_name: currentPeriod,
                target_quantity: summaryEdit,
                target_trips: 0,
                actual_trips: 0,
                actual_quantity: 0
            };
            if (globalPlan?.id) planPayload.id = globalPlan.id;

            await upsertPlan(planPayload);
            setSummaryEdit(null);
        } catch (err) {
            alert('Save failed: ' + err.message);
        }
    };

    const handleDeleteVessel = async (vesselId, vesselName) => {
        const confirmDelete = window.confirm(`ATTENZIONE OPERAZIONE DISTRUTTIVA!\nStai per eliminare per sempre la nave "${vesselName}". Tutte le card ed eventi legati potrebbero essere cancellati. Sei sicuro di voler procedere?`);
        if (!confirmDelete) return;

        try {
            const result = await deleteVessel(vesselId);
            if (!result.success) throw new Error(result.error || 'Errore database');
        } catch (error) {
            alert('Impossibile eliminare la nave. Potrebbe avere attività collegate nel database (Violazione chiave esterna). Errore: ' + error.message);
        }
    };

    const handleSaveVessel = async (vesselId) => {
        const edit = vesselEdits[vesselId];
        if (!edit) return;

        try {
            if (edit.cargo !== undefined) {
                await updateVessel(vesselId, { avg_cargo: Number(edit.cargo) });
            }

            const vessel = vessels.find(v => v.id === vesselId);
            const plan = (productionPlans || []).find(p => p.vessel_id === vesselId && p.period_name === currentPeriod);

            const trips = edit.trips !== undefined ? Number(edit.trips) : (plan?.target_trips || 0);
            const cargo = edit.cargo !== undefined ? Number(edit.cargo) : (vessel.avg_cargo || 0);
            const actualTrips = plan?.actual_trips || 0;

            const planPayload = {
                vessel_id: vesselId,
                period_name: currentPeriod,
                target_trips: trips,
                target_quantity: trips * cargo,
                actual_trips: actualTrips,
                actual_quantity: actualTrips * cargo, 
            };
            
            if (plan?.id) planPayload.id = plan.id; 

            await upsertPlan(planPayload);

            setVesselEdits(prev => {
                const next = { ...prev };
                delete next[vesselId];
                return next;
            });
        } catch (err) {
            alert('Save failed: ' + err.message);
        }
    };

    return (
        <div className="pt-tab-container p-4 lg:p-6">
            <SectionHeader 
                title="Production Targets" 
                subtitle="Monthly delivery quotas and efficiency tracking" 
                icon={Target}
            />
            
            <div className="tab-content production-targets-tab mt-4">
                {/* 1. Global Metrics (Top Row) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {/* Monthly Goal */}
                    <div className="bg-white rounded-2xl p-5 border border-surface-low border-b-4 border-b-primary shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Target size={24} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest">Monthly Goal</p>
                                <button className="text-on-surface/30 hover:text-primary transition-colors" onClick={() => summaryEdit !== null ? handleSaveSummary() : setSummaryEdit(totalTarget)}>
                                    {summaryEdit !== null ? <Check size={14} /> : <Edit2 size={12} />}
                                </button>
                            </div>
                            <div className="flex items-end gap-1">
                                {summaryEdit !== null ? (
                                    <input type="number" autoFocus value={summaryEdit} onChange={e => setSummaryEdit(Number(e.target.value))} className="w-full bg-surface-low/30 border-none rounded px-2 py-1 text-xl font-extrabold outline-none" />
                                ) : (
                                    <>
                                        <h3 className="text-2xl font-manrope font-extrabold text-on-surface leading-none">{totalTarget.toLocaleString()}</h3>
                                        <span className="text-xs font-bold text-on-surface/40 mb-0.5">tons</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Delivered */}
                    <div className="bg-white rounded-2xl p-5 border border-surface-low shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-500">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest mb-1">Delivered (Est.)</p>
                            <div className="flex items-end gap-1">
                                <h3 className="text-2xl font-manrope font-extrabold text-green-600 leading-none">{deliveredTotal.toLocaleString()}</h3>
                                <span className="text-xs font-bold text-green-600/60 mb-0.5">t</span>
                            </div>
                        </div>
                    </div>

                    {/* Remaining */}
                    <div className="bg-white rounded-2xl p-5 border border-surface-low shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                            <Package size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest mb-1">Remaining</p>
                            <div className="flex items-end gap-1">
                                <h3 className="text-2xl font-manrope font-extrabold text-amber-600 leading-none">{remainingTotal.toLocaleString()}</h3>
                                <span className="text-xs font-bold text-amber-600/60 mb-0.5">t</span>
                            </div>
                        </div>
                    </div>

                    {/* Overall Progress */}
                    <div className="bg-white rounded-2xl p-5 border border-surface-low shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full border-4 border-primary/20 flex items-center justify-center">
                            <div className="text-sm font-black text-primary">
                                {totalTarget > 0 ? Math.round((deliveredTotal / totalTarget) * 100) : 0}%
                            </div>
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest mb-2">Overall Progress</p>
                            <div className="h-1.5 w-full bg-surface-low rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${totalTarget > 0 ? Math.min(100, (deliveredTotal / totalTarget) * 100) : 0}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Vessel Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                    {(vessels || []).map(vessel => {
                        const plan = (productionPlans || []).find(p => p.vessel_id === vessel.id && p.period_name === currentPeriod);
                        const isEditing = vesselEdits[vessel.id] !== undefined;
                        const editData = vesselEdits[vessel.id] || {};
                        const targetTrips = isEditing ? editData.trips : (plan?.target_trips || 0);
                        const avgCargo = isEditing ? editData.cargo : (vessel.avg_cargo || 0);
                        const actualTrips = actualTripsMap[vessel.id] || 0;
                        
                        const tripProgressPercent = targetTrips > 0 
                            ? Math.round((actualTrips / targetTrips) * 100) 
                            : 0;

                        const targetQty = targetTrips * avgCargo;
                        const deliveredQty = actualTrips * (vessel.avg_cargo || 0);

                        return (
                            <div key={vessel.id} className="bg-white rounded-2xl p-5 border border-surface-low shadow-sm flex flex-col transition-all hover:shadow-md">
                                {/* Header */}
                                <div className="flex items-start justify-between mb-5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-md bg-on-surface/5 flex items-center justify-center text-primary">
                                            <Ship size={14} />
                                        </div>
                                        <h4 className="font-manrope font-extrabold text-[13px] tracking-tight text-on-surface mt-0.5">{vessel.name}</h4>
                                    </div>
                                    {isEditing ? (
                                        <div className="flex items-center gap-1.5">
                                            <button className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors" onClick={() => handleSaveVessel(vessel.id)}>
                                                <Check size={12} />
                                            </button>
                                            <button className="w-6 h-6 rounded-full bg-surface-low text-on-surface/50 flex items-center justify-center hover:bg-surface-low/80 transition-colors" onClick={() => setVesselEdits(prev => { const n = {...prev}; delete n[vessel.id]; return n; })}>
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button className="text-red-500/30 hover:text-red-600 transition-colors mt-1" onClick={() => handleDeleteVessel(vessel.id, vessel.name)} title="Elimina Nave">
                                                <Trash2 size={13} />
                                            </button>
                                            <button className="text-on-surface/30 hover:text-primary transition-colors mt-1" onClick={() => setVesselEdits({ ...vesselEdits, [vessel.id]: { cargo: vessel.avg_cargo || 0, trips: plan?.target_trips || 0 } })}>
                                                <Edit2 size={13} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Inputs / Stats */}
                                <div className="space-y-4 mb-6 relative">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-on-surface/60">Avg. Cargo / Trip</span>
                                        {isEditing ? (
                                            <input type="number" className="w-20 bg-surface-lowest border border-surface-low/50 rounded px-2 py-1 text-sm font-bold text-right outline-none ring-1 ring-primary/20" value={editData.cargo} onChange={e => setVesselEdits(prev => ({ ...prev, [vessel.id]: { ...prev[vessel.id], cargo: e.target.value } }))} />
                                        ) : (
                                            <span className="text-[13px] font-extrabold text-on-surface">{avgCargo} <span className="text-[9px] font-bold text-on-surface/40">tons</span></span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-on-surface/60">Target Trips / Month</span>
                                        {isEditing ? (
                                            <input type="number" className="w-20 bg-surface-lowest border border-surface-low/50 rounded px-2 py-1 text-sm font-bold text-right outline-none ring-1 ring-primary/20" value={editData.trips} onChange={e => setVesselEdits(prev => ({ ...prev, [vessel.id]: { ...prev[vessel.id], trips: e.target.value } }))} />
                                        ) : (
                                            <span className="text-[13px] font-extrabold text-on-surface">{targetTrips} <span className="text-[9px] font-bold text-on-surface/40">trips</span></span>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-4 mt-auto">
                                    <div className="flex justify-between items-end mb-1.5">
                                        <span className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest">Progress: {actualTrips} / {targetTrips === 0 ? '—' : targetTrips}</span>
                                        <span className="text-[10px] font-bold text-on-surface/40">{tripProgressPercent}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-surface-low rounded-full overflow-hidden">
                                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, tripProgressPercent)}%` }} />
                                    </div>
                                </div>

                                {/* Target vs Delivered Cards */}
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <div className="bg-surface-lowest rounded-xl py-3 px-2 text-center border border-surface-low/50">
                                        <div className="text-[8px] font-black text-on-surface/40 uppercase tracking-widest mb-1">Target</div>
                                        <div className="text-xs font-extrabold text-on-surface break-words">{targetQty.toLocaleString()} <span className="text-[9px] text-on-surface/40">t</span></div>
                                    </div>
                                    <div className="bg-[#f0fcf5] rounded-xl py-3 px-2 text-center border border-green-500/10">
                                        <div className="text-[8px] font-black text-green-600/60 uppercase tracking-widest mb-1">Delivered (Est.)</div>
                                        <div className="text-xs font-extrabold text-green-600 break-words">{deliveredQty.toLocaleString()} <span className="text-[9px] text-green-600/50">t</span></div>
                                    </div>
                                </div>

                                {/* Footer (Period) */}
                                <div className="text-center mt-5 mb-1 text-[8px] font-black text-on-surface/20 uppercase tracking-[0.2em]">
                                    {currentPeriod}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
