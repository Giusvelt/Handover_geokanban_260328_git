import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import {
    Ship, MapPin, Clock, Filter, RefreshCw, Anchor, Navigation,
    ArrowDownRight, ArrowUpRight, Search, Edit3, Check, X, Trash2, Plus,
    BookOpen, ShieldCheck, Wind, BarChart2, CalendarDays, MessageSquare, ChevronRight, FileText, CheckCircle, Eye
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

export default function VesselActivityTab() {
    const {
        activities, vessels, geofences, lastUpdate, loading,
        fetchActivities, crewVesselId, companyVesselIds, profile: userProfile, productionPlans, fleetKPIs
    } = useData();
    const perms = can(userProfile?.role);

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [showKpiArchive, setShowKpiArchive] = useState(true);
    const [vesselFilter, setVesselFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [logbookActivity, setLogbookActivity] = useState(null);
    const [chatActivity, setChatActivity] = useState(null);
    const [hoverData, setHoverData] = useState({ id: null, messages: [], loading: false });

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const activitiesInPeriod = useMemo(() => {
        if (!activities) return [];
        return activities.filter(a => {
            const d = new Date(a.startTime);
            const matchesTime = d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
            if (perms.seeAllVessels) return matchesTime;
            if (perms.seeCompanyVessels && companyVesselIds) return matchesTime && companyVesselIds.includes(a.vesselId);
            if (perms.seeOwnVesselOnly && crewVesselId) return matchesTime && a.vesselId === crewVesselId;
            return matchesTime;
        });
    }, [activities, selectedMonth, selectedYear, perms, crewVesselId, companyVesselIds]);

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

    const stats = useMemo(() => ({
        loading: filtered.filter(a => a.activity === 'Loading').length,
        navigation: filtered.filter(a => a.activity === 'Navigation').length,
        unloading: filtered.filter(a => a.activity === 'Unloading').length
    }), [filtered]);

    const kpiByMonth = useMemo(() => {
        const groups = {};
        
        // Data estrapolata in tempo zero dalle Supabase Views
        (fleetKPIs || []).forEach(k => {
            const jsMonth = k.month - 1; 
            const key = `${k.year}-${jsMonth}`;
            groups[key] = { 
                month: jsMonth, 
                year: k.year, 
                loading: k.loading_count || 0, 
                navigation: k.navigation_count || 0, 
                unloading: k.unloading_count || 0, 
                deliveredTons: k.delivered_tons || 0, 
                goalTons: 0 
            };
        });

        // Apprendimento Goal dai Piani di Produzione Master (vessel_id = null)
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
    }, [activities, productionPlans]);

    const handleCloseMonth = async () => {
        if (!confirm('Close current month and generate Certified SAL?')) return;
        const { data, error } = await supabase.rpc('certify_monthly_sal', { p_month: selectedMonth + 1, p_year: selectedYear });
        if (error) alert(error.message);
        else { alert('Certification successful! Hash: ' + data); fetchActivities(); }
    };

    const handleExportExcel = () => {
        const data = filtered.map(a => ({
            'Vessel': a.vessel, 'Activity': a.activity, 'Geofence': a.geofence,
            'Start': formatTime(a.startTime), 'End': formatTime(a.endTime), 'Duration': calcDuration(a.startTime, a.endTime)
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Activities");
        XLSX.writeFile(wb, `GeoKanban_Export_${selectedYear}_${selectedMonth + 1}.xlsx`);
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
            {/* KPI STATS & ARCHIVE visibili solo agli admin */}
            {perms.adminDashboard && (
                <>
                    {/* KPI STATS ROW */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Loading', value: stats.loading, icon: ArrowDownRight, color: 'text-green-500', bg: 'bg-green-50' },
                            { label: 'Navigation', value: stats.navigation, icon: Navigation, color: 'text-blue-500', bg: 'bg-blue-50' },
                            { label: 'Unloading', value: stats.unloading, icon: ArrowUpRight, color: 'text-amber-500', bg: 'bg-amber-50' },
                            { label: 'Vessels', value: (vessels || []).length, icon: Ship, color: 'text-purple-500', bg: 'bg-purple-50' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white/80 backdrop-blur-md rounded-[2rem] p-5 lg:p-6 border border-white shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                                <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform ${stat.color}`}>
                                    <stat.icon size={64} />
                                </div>
                                <div className="flex items-center gap-4 relative">
                                    <div className={`${stat.bg} ${stat.color} w-10 h-10 lg:w-12 lg:h-12 rounded-2xl flex items-center justify-center shadow-inner`}>
                                        <stat.icon size={20} className="lg:scale-110" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-on-surface/30 uppercase tracking-[0.2em] leading-none mb-1.5">{stat.label}</p>
                                        <h3 className="text-xl lg:text-3xl font-manrope font-black text-on-surface leading-none">{stat.value}</h3>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>


                    {/* KPI ARCHIVE SECTION - COMPACT */}
                    <div className="bg-white/50 backdrop-blur-md rounded-3xl p-5 lg:p-6 border border-white shadow-sm mb-4">
                        <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setShowKpiArchive(!showKpiArchive)}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <BarChart2 size={20} />
                                </div>
                                <div>
                                    <h3 className="font-manrope font-extrabold text-base lg:text-lg text-on-surface leading-tight">KPI / M</h3>
                                    <p className="text-[9px] font-black text-on-surface/20 uppercase tracking-[0.2em]">Monthly Performance Analytics</p>
                                </div>
                            </div>
                            <button className="text-on-surface/20 hover:text-primary transition-colors">
                                <RefreshCw size={16} className={showKpiArchive ? 'rotate-180' : ''} />
                            </button>
                        </div>

                        {showKpiArchive && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-separate border-spacing-y-2">
                                    <thead>
                                        <tr className="text-[9px] font-black text-on-surface/20 uppercase tracking-[0.2em]">
                                            <th className="px-5 py-2">Period</th>
                                            <th className="px-5 py-2">Loading</th>
                                            <th className="px-5 py-2">Navigation</th>
                                            <th className="px-5 py-2">Unloading</th>
                                            <th className="px-5 py-2">Goal</th>
                                            <th className="px-5 py-2">Ops</th>
                                            <th className="px-5 py-2 text-right">Achievement</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {kpiByMonth.map((k, i) => {
                                            const totalOps = k.loading + k.navigation + k.unloading;
                                            const pct = k.goalTons > 0 ? Math.round((k.deliveredTons / k.goalTons) * 100) : 0;
                                            const isCurrent = k.month === selectedMonth && k.year === selectedYear;

                                            return (
                                                <tr key={i} className="group">
                                                    <td className="px-5 py-3 bg-white rounded-l-xl shadow-sm border-l border-t border-b border-surface-low/5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-manrope font-extrabold text-sm text-on-surface">{MONTHS[k.month]} {k.year}</span>
                                                            {isCurrent && <span className="bg-primary/10 text-primary text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest">● Now</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 bg-white shadow-sm border-t border-b border-surface-low/5">
                                                        <span className="text-green-600 text-[11px] font-black font-manrope">{k.loading}</span>
                                                    </td>
                                                    <td className="px-5 py-3 bg-white shadow-sm border-t border-b border-surface-low/5">
                                                        <span className="text-blue-600 text-[11px] font-black font-manrope">{k.navigation}</span>
                                                    </td>
                                                    <td className="px-5 py-3 bg-white shadow-sm border-t border-b border-surface-low/5">
                                                        <span className="text-amber-600 text-[11px] font-black font-manrope">{k.unloading}</span>
                                                    </td>
                                                    <td className="px-5 py-3 bg-white shadow-sm border-t border-b border-surface-low/5 text-[11px] font-bold text-on-surface/20 italic">
                                                        {k.goalTons > 0 ? `${(k.goalTons/1000).toFixed(0)}k t` : '—'}
                                                    </td>
                                                    <td className="px-5 py-3 bg-white shadow-sm border-t border-b border-surface-low/5 font-manrope font-extrabold text-sm text-on-surface">
                                                        {totalOps}
                                                    </td>
                                                    <td className="px-5 py-3 bg-white rounded-r-xl shadow-sm border-r border-t border-b border-surface-low/5 text-right">
                                                        <div className="flex items-center justify-end gap-3">
                                                            <div className="flex flex-col items-end">
                                                                <div className="flex items-baseline gap-2">
                                                                    <span className="text-[12px] font-black text-on-surface">{pct}%</span>
                                                                    <span className="text-[8px] font-bold text-on-surface/20 uppercase">
                                                                        {Math.round(k.deliveredTons/1000)}k / {(k.goalTons/1000).toFixed(0)}k t
                                                                    </span>
                                                                </div>
                                                                <div className="w-20 h-1 bg-surface-low/30 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                                                                </div>
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
                            
                            {perms.adminDashboard && (
                                <>
                                    <button onClick={handleExportExcel} className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-surface-low/30 px-4 py-2 rounded-xl text-[9px] font-black text-on-surface/50 uppercase tracking-widest transition-all shadow-sm">
                                        <FileText size={12} className="text-primary/60" /> Export
                                    </button>
                                    <button onClick={handleCloseMonth} className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 active:scale-95 px-5 py-2 rounded-xl text-[9px] font-black text-white uppercase tracking-widest shadow-md shadow-red-200 transition-all">
                                        <ShieldCheck size={12} /> Certify SAL
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
                                    <th className="px-4 py-3">Geofence / Hub</th>
                                    <th className="px-4 py-3">Arrived (ATA)</th>
                                    <th className="px-4 py-3">Departed (ATD)</th>
                                    <th className="px-4 py-3">Duration</th>
                                    <th className="px-4 py-3 text-center">Log</th>
                                    <th className="px-4 py-3 text-right">Comms</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((a, i) => (
                                    <tr key={a.id} className="group">
                                        <td className="px-4 py-3 bg-white rounded-l-xl text-[10px] font-black text-on-surface/10">{i + 1}</td>
                                        <td className="px-4 py-3 bg-white font-manrope font-extrabold text-xs text-on-surface uppercase tracking-tight">{a.vessel}</td>
                                        <td className="px-4 py-3 bg-white">
                                            <span className="text-[9px] font-black uppercase tracking-tight px-2 py-0.5 rounded-lg border border-current/10" style={{ backgroundColor: `${activityColor(a.activity)}10`, color: activityColor(a.activity) }}>
                                                {a.activity}
                                            </span>
                                        </td>
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
                                            <div className="flex justify-center">
                                                {a.logbookStatus === 'submitted' || a.logbookStatus === 'approved' ? (
                                                    <div className="text-green-500 hover:scale-110 transition-transform cursor-pointer" title="Submitted Entry">
                                                        <CheckCircle size={18} weight="bold" />
                                                    </div>
                                                ) : (
                                                    <div className="text-on-surface/20" title="Draft / Missing">
                                                        <FileText size={18} />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 bg-white rounded-r-xl text-right relative">
                                            <button 
                                                onClick={() => setChatActivity(a)} 
                                                onMouseEnter={() => handleMessageHover(a.id)}
                                                onMouseLeave={() => setHoverData({ id: null, messages: [], loading: false })}
                                                className={`w-8 h-8 rounded-full inline-flex items-center justify-center transition-all shadow-sm ${
                                                    (a.totalMsgCount > 0)
                                                    ? 'bg-blue-900 text-white hover:bg-blue-800' 
                                                    : 'bg-surface-low/30 text-on-surface/20 hover:bg-secondary hover:text-white'
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
                                ))}
                            </tbody>
                        </table>
                        {!filtered.length && (
                            <div className="py-12 text-center text-on-surface/40 font-bold text-sm">
                                Nessuna attività trovata in questo periodo.
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
