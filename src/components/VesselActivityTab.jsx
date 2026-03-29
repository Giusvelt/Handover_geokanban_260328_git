import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import {
    Ship, MapPin, Clock, Filter, RefreshCw, Anchor, Navigation,
    ArrowDownRight, ArrowUpRight, Search, Edit3, Check, X, Trash2, Plus,
    BookOpen, ShieldCheck, Wind, BarChart2, CalendarDays, MessageSquare, ChevronRight, FileText, CheckCircle, Eye,
    Target, TrendingUp, Package
} from 'lucide-react';
import LogbookEntryModal from './LogbookEntryModal';
import ActivityChatModal from './ActivityChatModal';
import { useUserProfile } from '../hooks/useUserProfile';
import { can } from '../lib/permissions';

const formatTime = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
};

const calcDuration = (start, end) => {
    if (!start || !end) return null;
    const ms = new Date(end) - new Date(start);
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins} m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h < 24) return `${h}h ${m} m`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24} h`;
};

const activityColor = (activity) => {
    const map = {
        'Loading': '#10b981', 'Unloading': '#f59e0b',
        'Navigation': '#3b82f6', 'Anchorage': '#8b5cf6',
        'Stand-by': '#64748b', 'Port Operations': '#06b6d4', 'Mooring': '#14b8a6'
    };
    return map[activity] || '#94a3b8';
};

export default function VesselActivityTab({ 
    view = 'all',
    selectedMonth, setSelectedMonth,
    selectedYear, setSelectedYear,
    vesselFilter, setVesselFilter
}) {
    const {
        activities, vessels, geofences, lastUpdate, loading,
        fetchActivities, crewVesselId, companyVesselIds, profile: userProfile, productionPlans, fleetKPIs, vesselKPIs
    } = useData();
    const perms = can(userProfile?.role);

    const [showKpiArchive, setShowKpiArchive] = useState(true);
    const [search, setSearch] = useState('');
    const [logbookActivity, setLogbookActivity] = useState(null);
    const [chatActivity, setChatActivity] = useState(null);
    const [hoverData, setHoverData] = useState({ id: null, messages: [], loading: false });

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const { aisStats, activitiesInPeriod } = useMemo(() => {
        if (!activities) return { aisStats: { total: 0, submitted: 0 }, activitiesInPeriod: [] };
        
        let total = 0;
        let submittedCount = 0;

        const filtered = activities.filter(a => {
            const d = new Date(a.startTime);
            const matchesTime = d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
            
            // Filtro Permission (Check di base)
            let isVisible = matchesTime;
            if (perms.seeCompanyVessels && companyVesselIds) isVisible = matchesTime && companyVesselIds.includes(a.vesselId);
            if (perms.seeOwnVesselOnly && crewVesselId) isVisible = matchesTime && a.vesselId === crewVesselId;
            
            if (!isVisible) return false;

            // Logica Contatori (su base visibile/permessa)
            total++;
            const isSubmitted = ['submitted', 'approved'].includes(a.logbookStatus);
            if (isSubmitted) submittedCount++;

            // Filtro Vista
            if (view === 'submitted' && !isSubmitted) return false;
            // ADMIN PERSISTENCE: Se admin (Operations/Admin), vede tutto nel tab Vessel Activity (view === 'to-submit')
            if (view === 'to-submit' && isSubmitted && !perms.adminDashboard) return false;

            return true;
        });

        return {
            aisStats: { total, submitted: submittedCount },
            activitiesInPeriod: filtered
        };
    }, [activities, selectedMonth, selectedYear, perms, crewVesselId, companyVesselIds, view, userProfile]);

    const filtered = useMemo(() => {
        let base = activitiesInPeriod || [];
        const q = search.toLowerCase().trim();
        if (vesselFilter !== 'All') base = base.filter(a => a.vessel === vesselFilter);
        if (q) base = base.filter(a => 
            a.vessel?.toLowerCase().includes(q) || 
            a.activity?.toLowerCase().includes(q) || 
            (a.geofence || '').toLowerCase().includes(q)
        );
        return base;
    }, [activitiesInPeriod, vesselFilter, search]);

    const kpiByMonth = useMemo(() => {
        const groups = {};
        
        // Step 1 — Contatori da monthly_fleet_kpi (Loading / Nav / Unloading)
        (fleetKPIs || []).forEach(k => {
            const jsMonth = k.month - 1; 
            const key = `${k.year}-${jsMonth}`;
            groups[key] = { 
                month: jsMonth, 
                year: k.year, 
                loading: k.loading_count || 0, 
                navigation: k.navigation_count || 0, 
                unloading: k.unloading_count || 0, 
                deliveredTons: 0, // override sotto con vesselKPIs
                goalTons: 0 
            };
        });

        // Step 2 — Tonnaggio da monthly_vessel_kpi (stima trip×avg_cargo o certificato)
        // Stessa logica robusta del Production Target Tab
        (vesselKPIs || []).forEach(kpi => {
            const jsMonth = kpi.month - 1;
            const key = `${kpi.year}-${jsMonth}`;
            if (!groups[key]) {
                groups[key] = { month: jsMonth, year: kpi.year, loading: 0, navigation: 0, unloading: 0, deliveredTons: 0, goalTons: 0 };
            }
            const qty = (kpi.actual_quantity_certified > 0)
                ? kpi.actual_quantity_certified
                : (kpi.actual_quantity_estimated || 0);
            groups[key].deliveredTons += qty;
        });

        // Step 3 — Goal dai Piani di Produzione Master (vessel_id = null)
        (productionPlans || []).forEach(p => {
             if (p.vessel_id === null && p.period_name) {
                 try {
                     const [mName, yStr] = p.period_name.split(' ');
                     const mIdx = MONTHS.indexOf(mName);
                     if (mIdx !== -1 && yStr) {
                         const key = `${yStr}-${mIdx}`;
                         if (groups[key]) groups[key].goalTons = p.target_quantity || 0;
                     }
                 } catch(e) {}
             }
        });
        return Object.values(groups).sort((a,b) => b.year - a.year || b.month - a.month);
    }, [fleetKPIs, vesselKPIs, productionPlans]);

    const stats = useMemo(() => {
        const current = kpiByMonth.find(k => k.month === selectedMonth && k.year === selectedYear) || {
            loading: 0, navigation: 0, unloading: 0, deliveredTons: 0, goalTons: 0
        };
        const totalTarget = current.goalTons || 0;
        const deliveredTotal = current.deliveredTons || 0;
        const remainingTotal = Math.max(0, totalTarget - deliveredTotal);
        const progressPct = totalTarget > 0 ? Math.round((deliveredTotal / totalTarget) * 100) : 0;

        return {
            loading: current.loading,
            navigation: current.navigation,
            unloading: current.unloading,
            totalAis: aisStats.total,
            submittedAis: aisStats.submitted,
            deliveredTons: deliveredTotal,
            goalTons: totalTarget,
            remainingTons: remainingTotal,
            progress: progressPct
        };
    }, [kpiByMonth, selectedMonth, selectedYear, aisStats]);

    const handleCloseMonth = async () => {
        if (!confirm('Close current month and generate Certified SAL?')) return;
        const { data, error } = await supabase.rpc('certify_monthly_sal', { p_month: selectedMonth + 1, p_year: selectedYear });
        if (error) alert(error.message);
        else { alert('Certification successful! Hash: ' + data); fetchActivities(); }
    };
    const handleExportExcel = () => {
        const data = filtered.map(a => {
            const entry = a.logbookEntry || {};
            const sf = entry.structured_fields || {};
            
            return {
                'Ref': a.id,
                'Vessel': a.vessel,
                'Activity': a.activity,
                'Geofence': a.geofence,
                'Arrived (ATA)': formatTime(a.startTime),
                'Departed (ATD)': a.endTime ? formatTime(a.endTime) : 'In Progress',
                'Duration': calcDuration(a.startTime, a.endTime),
                'Status': a.logbookStatus || 'None',
                'Digital Hash': entry.document_hash || '—',
                'Narrative (Notes)': entry.narrative_text || '—',
                'Pilots IN': sf.arrival_pilot_in ? formatTime(sf.arrival_pilot_in) : '—',
                'Pilots OUT': sf.arrival_pilot_out ? formatTime(sf.arrival_pilot_out) : '—',
                'Moor IN': sf.arrival_mooring_in ? formatTime(sf.arrival_mooring_in) : '—',
                'Moor OUT': sf.arrival_mooring_out ? formatTime(sf.arrival_mooring_out) : '—',
                'Tug Units': sf.arrival_tug_count || 0,
                'Tug Start': sf.arrival_tug_in ? formatTime(sf.arrival_tug_in) : '—',
                'Tug End': sf.arrival_tug_out ? formatTime(sf.arrival_tug_out) : '—'
            };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Certified Activities");
        XLSX.writeFile(wb, `GeoKanban_Certified_Export_${selectedYear}_${selectedMonth + 1}.xlsx`);
    };

    const handleMessageHover = async (activityId) => {
        if (hoverData.id === activityId) return;
        setHoverData({ id: activityId, messages: [], loading: true });
        try {
            const { data, error } = await supabase
                .from('activity_messages')
                .select('message_text, sender_role')
                .eq('vessel_activity_id', activityId)
                .order('created_at', { ascending: false })
                .limit(2);
            if (error) throw error;
            setHoverData({ id: activityId, messages: (data || []).reverse(), loading: false });
        } catch (err) {
            console.error('Error fetching hover messages:', err);
            setHoverData({ id: null, messages: [], loading: false });
        }
    };

    return (
        <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-1000 pb-20">
            {/* KPI STATS & ARCHIVE visibili solo agli admin nel tab principale o 'all' */}
            {perms.adminDashboard && (view === 'all' || view === 'to-submit') && (
                <>
                    {/* PRODUCTION KPI ROW — PHASE 28 */}
                    <div className="production-stats-grid">
                        {[
                            { label: 'Monthly Goal', value: stats.goalTons.toLocaleString(), unit: 'tons', icon: Target, color: 'text-primary', bg: 'bg-primary/10', border: 'border-b-primary shadow-sm' },
                            { label: 'Delivered (Est.)', value: stats.deliveredTons.toLocaleString(), unit: 't', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
                            { label: 'Remaining', value: stats.remainingTons.toLocaleString(), unit: 't', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
                            { label: 'Overall Progress', progress: stats.progress, icon: BarChart2, color: 'text-primary', bg: 'bg-primary/5' },
                        ].map((stat, i) => (
                            <div key={i} className={`bg-white rounded-2xl p-5 border border-surface-low ${stat.border || ''} flex items-center gap-4`}>
                                {stat.progress !== undefined ? (
                                    <>
                                        <div className="w-12 h-12 rounded-full border-4 border-primary/20 flex items-center justify-center">
                                            <div className="text-sm font-black text-primary">{stat.progress}%</div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest mb-2">{stat.label}</p>
                                            <div className="h-1.5 w-full bg-surface-low rounded-full overflow-hidden">
                                                <div className="h-full bg-primary" style={{ width: `${stat.progress}%` }} />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={`w-12 h-12 rounded-full ${stat.bg} flex items-center justify-center ${stat.color}`}>
                                            <stat.icon size={24} />
                                        </div>
                                        <div className="flex-1">
                                             <p className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest mb-1">{stat.label}</p>
                                             <div className="flex items-end gap-1">
                                                 <h3 className={`text-2xl font-manrope font-extrabold ${stat.color} leading-none`}>{stat.value}</h3>
                                                 <span className={`text-xs font-bold ${stat.color}/60 mb-0.5`}>{stat.unit}</span>
                                             </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* COMPACT OPERATIONAL STATS ROW — PHASE 28 */}
                    <div className="stats-row-compact">
                        {[
                            { label: 'Loading', value: stats.loading, color: 'text-green-500' },
                            { label: 'Navigation', value: stats.navigation, color: 'text-blue-500' },
                            { label: 'Unloading', value: stats.unloading, color: 'text-amber-500' },
                            { label: 'Tracked Vessels', value: (vessels || []).length, color: 'text-purple-500' },
                        ].map((stat, i) => (
                            <div key={i} className="stat-card-compact group">
                                <span className="stat-label">{stat.label}</span>
                                <span className={`stat-value ${stat.color}`}>{stat.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* KPI ARCHIVE SECTION — PREMIUM VERSION */}
                    <div className="kpi-archive-section">
                        <div className="kpi-archive-header" onClick={() => setShowKpiArchive(!showKpiArchive)}>
                            <BarChart2 size={18} />
                            <span>KPI / M — Monthly Performance Archive</span>
                            <div className="kpi-archive-toggle">
                                <RefreshCw size={14} className={showKpiArchive ? 'rotate-180 transition-transform duration-500' : 'transition-transform duration-500'} />
                            </div>
                        </div>

                        {showKpiArchive && (
                            <div className="kpi-archive-table-wrap">
                                <table className="kpi-archive-table">
                                    <thead>
                                        <tr>
                                            <th>Period</th>
                                            <th>Loading</th>
                                            <th>Navigation</th>
                                            <th>Unloading</th>
                                            <th>Goal</th>
                                            <th>Ops</th>
                                            <th className="text-right">Achievement</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {kpiByMonth.map((k, i) => {
                                            const totalOps = k.loading + k.navigation + k.unloading;
                                            const pct = k.goalTons > 0 ? Math.round((k.deliveredTons / k.goalTons) * 100) : 0;
                                            const isCurrent = k.month === selectedMonth && k.year === selectedYear;

                                            return (
                                                <tr key={i} className={isCurrent ? 'kpi-row-active' : ''}>
                                                    <td>
                                                        <div className="flex items-center gap-2">
                                                            <CalendarDays size={14} className="opacity-20" />
                                                            <span>{MONTHS[k.month]} {k.year}</span>
                                                            {isCurrent && <span className="bg-primary/10 text-primary text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ml-2">Active</span>}
                                                        </div>
                                                    </td>
                                                    <td><span className="kpi-badge loading">{k.loading}</span></td>
                                                    <td><span className="kpi-badge navigation">{k.navigation}</span></td>
                                                    <td><span className="kpi-badge unloading">{k.unloading}</span></td>
                                                    <td className="italic text-on-surface/30">
                                                        {k.goalTons > 0 ? `${(k.goalTons/1000).toFixed(0)}k t` : '—'}
                                                    </td>
                                                    <td>{totalOps}</td>
                                                    <td className="text-right">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="font-black text-sm">{pct}%</span>
                                                                <span className="text-[9px] opacity-40">
                                                                    {Math.round(k.deliveredTons/1000)}k / {(k.goalTons/1000).toFixed(0)}k t
                                                                </span>
                                                            </div>
                                                            <div className="w-24 h-1.5 bg-surface-low rounded-full overflow-hidden">
                                                                <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* TOOLBAR COMPACT - OPTIMIZED */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white/50 backdrop-blur-md rounded-[1.5rem] p-1.5 border border-white shadow-sm">
                        <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-[1.25rem] border border-surface-low/30 shadow-inner max-w-xs flex-1 ml-0.5">
                            <Search size={14} className="text-on-surface/20" />
                            <input type="text" placeholder="Search activities..." className="bg-transparent border-none outline-none text-[11px] font-bold text-on-surface w-full placeholder:text-on-surface/20 uppercase tracking-tight" value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-1.5 pr-0.5">
                            <div className="flex items-center bg-white border border-surface-low/30 rounded-xl overflow-hidden shadow-sm">
                                <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent pl-4 pr-2 py-2 text-[9px] font-black uppercase text-on-surface outline-none cursor-pointer hover:bg-surface-low/10 transition-colors">
                                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                </select>
                                <div className="w-px h-4 bg-surface-low/30" />
                                <select value={vesselFilter} onChange={e => setVesselFilter(e.target.value)} className="bg-transparent pl-2 pr-4 py-2 text-[9px] font-black uppercase text-on-surface outline-none cursor-pointer hover:bg-surface-low/10 transition-colors">
                                    <option value="All">All Vessels</option>
                                    {perms.adminDashboard ? (
                                        vessels?.map(v => <option key={v.id} value={v.name}>{v.name}</option>)
                                    ) : (
                                        <option value={userProfile?.vesselName || 'Crew'}>{userProfile?.vesselName || 'My Vessel'}</option>
                                    )}
                                </select>
                            </div>
                            
                            {(perms.adminDashboard || view === 'submitted') && (
                                <>
                                    <button onClick={handleExportExcel} className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-surface-low/30 px-4 py-2 rounded-xl text-[9px] font-black text-on-surface/50 uppercase tracking-widest transition-all shadow-sm">
                                        <FileText size={12} className="text-primary/60" /> Export Certified
                                    </button>
                                </>
                            )}
                            
                            <button onClick={fetchActivities} className={`w-9 h-9 bg-white border border-surface-low/30 text-on-surface/20 rounded-full flex items-center justify-center transition-all hover:text-primary hover:border-primary/30 shadow-sm ${loading ? 'animate-spin border-primary' : ''}`}>
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>

                    {/* TABLE COMPACT */}
                    <div className="bg-white/50 backdrop-blur-md rounded-2xl p-2 lg:p-4 border border-white shadow-sm overflow-x-auto mt-2">
                        <table className="w-full text-left border-separate border-spacing-y-1">
                            <thead>
                                <tr className="text-[9px] font-black text-on-surface/20 uppercase tracking-[0.1em]">
                                    <th className="px-4 py-3">Ref</th>
                                    <th className="px-4 py-3">Vessel</th>
                                    <th className="px-4 py-3">Activity</th>
                                    {view === 'submitted' ? (
                                        <>
                                            <th className="px-4 py-3">ATA / ATD</th>
                                            <th className="px-4 py-3">Pilots (In/Out)</th>
                                            <th className="px-4 py-3">Moor (In/Out)</th>
                                            <th className="px-4 py-3">Tugs (U / S {'>'} E)</th>
                                            <th className="px-4 py-3">Note / Narrative</th>
                                            <th className="px-4 py-3">Certified Hash</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-4 py-3">Geofence / Hub</th>
                                            <th className="px-4 py-3">Arrived (ATA)</th>
                                            <th className="px-4 py-3">Departed (ATD)</th>
                                            <th className="px-4 py-3">Duration</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                        </>
                                    )}
                                    <th className="px-4 py-3 text-right">MSG</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((a, i) => {
                                    const isSubmitted = ['submitted', 'approved'].includes(a.logbookStatus);
                                    const entry = a.logbookEntry || {};
                                    const sf = entry.structured_fields || {};
                                    
                                    return (
                                        <tr key={a.id} className="group">
                                            <td className="px-4 py-3 bg-white rounded-l-xl text-[10px] font-black text-on-surface/10">{i + 1}</td>
                                            <td className="px-4 py-3 bg-white font-manrope font-extrabold text-xs text-on-surface uppercase tracking-tight">{a.vessel}</td>
                                            <td className="px-4 py-3 bg-white">
                                                <span className="text-[9px] font-black uppercase tracking-tight px-2 py-0.5 rounded-lg border border-current/10" style={{ backgroundColor: `${activityColor(a.activity)}10`, color: activityColor(a.activity) }}>
                                                    {a.activity}
                                                </span>
                                            </td>
                                            
                                            {view === 'submitted' ? (
                                                <>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-bold text-on-surface/60">
                                                        {formatTime(a.startTime)} <br/> {a.endTime ? formatTime(a.endTime) : '...'}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-bold text-on-surface/80">
                                                        {sf.arrival_pilot_in ? formatTime(sf.arrival_pilot_in).split(' ')[1] : '—'} <br/>
                                                        {sf.arrival_pilot_out ? formatTime(sf.arrival_pilot_out).split(' ')[1] : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-bold text-on-surface/80">
                                                        {sf.arrival_mooring_in ? formatTime(sf.arrival_mooring_in).split(' ')[1] : '—'} <br/>
                                                        {sf.arrival_mooring_out ? formatTime(sf.arrival_mooring_out).split(' ')[1] : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-bold text-on-surface/80">
                                                        {sf.arrival_tug_count || 0} U {sf.arrival_tug_in ? formatTime(sf.arrival_tug_in).split(' ')[1] : '—'} {'>'} {sf.arrival_tug_out ? formatTime(sf.arrival_tug_out).split(' ')[1] : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-bold text-on-surface/40 italic truncate max-w-[120px]">
                                                        {entry.narrative_text || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-black text-primary/60 font-mono tracking-tight">
                                                        {entry.document_hash ? entry.document_hash.substring(0, 16).toUpperCase() + '...' : 'PENDING'}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-center">
                                                        <div className="flex justify-center items-center gap-2">
                                                            <div className={`${isSubmitted ? 'text-green-500' : 'text-on-surface/20'} transition-transform`} title={isSubmitted ? "Submitted" : "Draft"}>
                                                                <CheckCircle size={18} />
                                                            </div>
                                                            {perms.editActivities && !isSubmitted && (
                                                                <button 
                                                                    onClick={() => setLogbookActivity(a)}
                                                                    className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all group"
                                                                >
                                                                    <Edit3 size={12} className="group-hover:scale-110 transition-transform" />
                                                                    Edit
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-3 bg-white text-[11px] font-bold text-on-surface/40 italic truncate max-w-[150px]">
                                                        <div className="flex items-center gap-1.5">
                                                            <MapPin size={10} className="opacity-20 flex-shrink-0" />
                                                            {a.geofence || 'Navigation'}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-bold text-on-surface/60">{formatTime(a.startTime)}</td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-bold text-on-surface/60">
                                                        {a.endTime ? formatTime(a.endTime) : <span className="text-primary italic animate-pulse">In Progress...</span>}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[9px] font-black text-on-surface/20 uppercase">{calcDuration(a.startTime, a.endTime) || '—'}</td>
                                                    <td className="px-4 py-3 bg-white text-center">
                                                        <div className="flex justify-center items-center gap-2">
                                                            <div className={`${isSubmitted ? 'text-green-500' : 'text-on-surface/20'} transition-transform cursor-pointer`} title={isSubmitted ? "Submitted Entry" : "Draft / Missing"}>
                                                                <CheckCircle size={18} />
                                                            </div>
                                                            {perms.editActivities && !isSubmitted && (
                                                                <button 
                                                                    onClick={() => setLogbookActivity(a)}
                                                                    className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all group"
                                                                >
                                                                    <Edit3 size={12} className="group-hover:scale-110 transition-transform" />
                                                                    Edit
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </>
                                            )}

                                            <td className="px-4 py-3 bg-white rounded-r-xl text-right relative">
                                                <button 
                                                    onClick={() => setChatActivity(a)} 
                                                    onMouseEnter={() => handleMessageHover(a.id)}
                                                    onMouseLeave={() => setHoverData({ id: null, messages: [], loading: false })}
                                                    className={`w-8 h-8 rounded-full inline-flex items-center justify-center transition-all shadow-sm ${
                                                        (a.totalMsgCount > 0)
                                                        ? 'bg-blue-900 text-white hover:bg-blue-800' 
                                                        : 'bg-surface-low text-on-surface/20 hover:bg-secondary hover:text-white'
                                                    }`}
                                                >
                                                    <MessageSquare size={13} />
                                                    {a.unreadMsgCount > 0 && (
                                                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white pointer-events-none" />
                                                    )}
                                                </button>

                                                {/* MESSAGE TOOLTIP (VIGNETTA) */}
                                                {hoverData.id === a.id && !hoverData.loading && hoverData.messages.length > 0 && (
                                                    <div className="absolute bottom-full right-4 mb-2 z-50 w-64 bg-[#002B5B] text-white p-3 rounded-2xl shadow-xl animate-in zoom-in-95 fade-in duration-200 pointer-events-none">
                                                        <div className="space-y-2">
                                                            {hoverData.messages.map((m, idx) => (
                                                                <div key={idx} className="flex items-start gap-2 text-[10px] font-bold leading-tight">
                                                                    <span className="flex-shrink-0 opacity-50 mt-0.5">
                                                                        {m.sender_role === 'crew' ? '📤' : '📥'}
                                                                    </span>
                                                                    <p className="text-left line-clamp-2 italic">{m.message_text}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {/* Triangle pointer */}
                                                        <div className="absolute top-full right-4 -mt-1 w-3 h-3 bg-[#002B5B] rotate-45" />
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {!filtered.length && (
                            <div className="py-12 text-center text-on-surface/40 font-bold text-sm">
                                No activities found in this period.
                            </div>
                        )}
                    </div>

            {logbookActivity && (
                <LogbookEntryModal 
                    activity={logbookActivity} 
                    profile={userProfile}
                    entryMeta={logbookActivity.logbookEntry} // assuming activity has logbookEntry or we just pass empty
                    onClose={() => setLogbookActivity(null)} 
                    onSaved={fetchActivities}
                />
            )}
            {chatActivity && <ActivityChatModal activity={chatActivity} profile={userProfile} onClose={() => { setChatActivity(null); fetchActivities(); }} />}
        </div>
    );
}
