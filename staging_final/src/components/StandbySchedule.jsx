import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { Calendar, ChevronLeft, ChevronRight, AlertCircle, Clock, Save, X, Plus } from 'lucide-react';
import '../logbook-writer.css';
import { can } from '../lib/permissions';
import SectionHeader from './SectionHeader';

export default function StandbySchedule() {
    const { profile, vessels, standbyReasons, schedules, fetchSchedules, companyVesselIds } = useData();
    const perms = can(profile?.role);

    const visibleVessels = useMemo(() => {
        if (perms.seeAllVessels) return vessels || [];
        if (perms.seeCompanyVessels && companyVesselIds) {
            return (vessels || []).filter(v => companyVesselIds.includes(v.id));
        }
        return (vessels || []).filter(v => v.id === profile?.vesselId);
    }, [vessels, perms, companyVesselIds, profile?.vesselId]);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedVesselId, setSelectedVesselId] = useState(
        perms.seeOwnVesselOnly ? profile?.vesselId : ''
    );

    // Ensure selectedVesselId has a default once vessels load
    React.useEffect(() => {
        if (!selectedVesselId && visibleVessels.length > 0) {
            setSelectedVesselId(perms.seeOwnVesselOnly ? profile?.vesselId : visibleVessels[0].id);
        }
    }, [visibleVessels, selectedVesselId, profile?.vesselId, perms.seeOwnVesselOnly]);

    // Modal state
    const [selectedDate, setSelectedDate] = useState(null);
    const [modalData, setModalData] = useState({ reasonId: '', notes: '' });
    const [saving, setSaving] = useState(false);

    // Helpers for calendar
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    // For Admin: Calculate upcoming 7 days standbys for Sidebar
    const upcomingStandbys = useMemo(() => {
        if (perms.seeOwnVesselOnly) return [];
        const next7Days = new Date(today);
        next7Days.setDate(today.getDate() + 7);

        return (schedules || []).filter(s => {
            if (!perms.seeAllVessels && companyVesselIds && !companyVesselIds.includes(s.vessel_id)) return false;
            const d = new Date(s.standby_date);
            return d >= today && d <= next7Days;
        }).sort((a, b) => new Date(a.standby_date) - new Date(b.standby_date));
    }, [schedules, perms, today, companyVesselIds]);

    // Current vessel schedules
    const vesselSchedules = useMemo(() => {
        return (schedules || []).filter(s => s.vessel_id === selectedVesselId).reduce((acc, s) => {
            acc[s.standby_date] = s;
            return acc;
        }, {});
    }, [schedules, selectedVesselId]);

    const handleDayClick = (day) => {
        if (!perms.editSchedule) return; 
        const dateClicked = new Date(year, month, day);
        if (dateClicked < today) return; 

        const dateStr = dateClicked.toISOString().split('T')[0];
        const existing = vesselSchedules[dateStr];

        setSelectedDate(dateClicked);
        setModalData({
            reasonId: existing?.standby_reason_id || '',
            notes: existing?.notes || ''
        });
    };

    const handleSaveStandby = async () => {
        if (!selectedDate || !modalData.reasonId) return;
        setSaving(true);
        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const { error } = await supabase.from('vessel_standby_schedule').upsert({
                vessel_id: selectedVesselId,
                standby_date: dateStr,
                standby_reason_id: modalData.reasonId,
                notes: modalData.notes,
                created_by: profile.id,
                updated_at: new Date().toISOString()
            }, { onConflict: 'vessel_id, standby_date' });

            if (!error) {
                await fetchSchedules();
                setSelectedDate(null);
            } else {
                console.error("Failed to save standby", error);
                alert("Error saving standby");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteStandby = async () => {
        if (!selectedDate) return;
        setSaving(true);
        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const existing = vesselSchedules[dateStr];
            if (existing) {
                await supabase.from('vessel_standby_schedule').delete().eq('id', existing.id);
                await fetchSchedules();
            }
            setSelectedDate(null);
        } finally {
            setSaving(false);
        }
    };

    const renderCalendarDays = () => {
        const blks = [];
        for (let i = 0; i < firstDay; i++) {
            blks.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dateStr = date.toISOString().split('T')[0];
            const isToday = date.getTime() === today.getTime();
            const isPast = date < today;
            const data = vesselSchedules[dateStr];

            blks.push(
                <div
                    key={d}
                    className={`cal-day ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${data ? 'has-event' : ''} ${perms.editSchedule && !isPast ? 'clickable' : ''}`}
                    onClick={() => handleDayClick(d)}
                >
                    <span className="day-num">{d}</span>
                    {data && (
                        <div className="day-event tooltip-trigger" style={{ marginTop: 'auto' }}>
                            <div className="event-pill" style={{ background: '#f59e0b', color: 'white', fontSize: '10px', padding: '2px 4px', borderRadius: '4px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {data.standby_reasons?.code || 'Standby'}
                            </div>
                            <div className="tooltip">
                                <strong>{data.standby_reasons?.name}</strong>
                                {data.notes && <p style={{ margin: '4px 0 0 0' }}>{data.notes}</p>}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        return blks;
    };

    return (
        <div className="pt-tab-container">
            <SectionHeader 
                title="Schedule & Stand-by" 
                subtitle="Fleet availability and planned maintenance windows" 
                icon={Calendar}
                actions={!perms.seeOwnVesselOnly && (
                    <select
                        value={selectedVesselId || ''}
                        onChange={(e) => setSelectedVesselId(e.target.value)}
                        className="bg-white/50 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface outline-none focus:ring-2 ring-primary/20"
                    >
                        {visibleVessels.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                )}
            />

            <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                <div style={{ flex: 1, background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <button onClick={prevMonth} className="btn-icon w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-low transition-colors"><ChevronLeft size={16} /></button>
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </h3>
                            <button onClick={nextMonth} className="btn-icon w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-low transition-colors"><ChevronRight size={16} /></button>
                        </div>

                        <div className="cal-grid">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="cal-header-day text-[10px] uppercase font-black opacity-30 tracking-widest">{day}</div>
                            ))}
                            {renderCalendarDays()}
                        </div>
                    </div>
                </div>

                {/* Sidebar for Operations/Crew Admin */}
                {!perms.seeOwnVesselOnly && (
                    <div style={{ width: '260px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={14} color="#f59e0b" />
                                <h3 style={{ margin: 0, fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upcoming (7 Days)</h3>
                            </div>
                        </div>
                        <div style={{ padding: '12px', flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                            {upcomingStandbys.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px', marginTop: '20px', fontStyle: 'italic' }}>
                                    No stand-bys scheduled.
                                </div>
                            ) : (
                                upcomingStandbys.map(s => {
                                    const d = new Date(s.standby_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                                    return (
                                        <div key={s.id} style={{ marginBottom: '8px', padding: '8px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                            <div style={{ fontSize: '9px', fontWeight: '900', color: '#b45309', marginBottom: '2px', textTransform: 'uppercase' }}>
                                                {d}
                                            </div>
                                            <div style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a' }}>
                                                {s.vessels?.name}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px', fontWeight: '700' }}>
                                                {s.standby_reasons?.code}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal for Crew to Edit/Add */}
            {selectedDate && (
                <div className="lem-overlay">
                    <div className="lem-modal" style={{ maxWidth: '400px' }}>
                        <div className="lem-header">
                            <div>
                                <h2>Stand-by Declaration</h2>
                                <p style={{ fontSize: '12px', color: '#64748b' }}>
                                    Date: {selectedDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                            <button className="lem-close" onClick={() => setSelectedDate(null)}><X size={18} /></button>
                        </div>
                        <div className="lem-body" style={{ padding: '20px' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Stand-by Reason</label>
                                <select
                                    className="edit-select"
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                    value={modalData.reasonId}
                                    onChange={e => setModalData({ ...modalData, reasonId: e.target.value })}
                                >
                                    <option value="">-- Select Reason --</option>
                                    {standbyReasons.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Notes (Optional)</label>
                                <textarea
                                    className="lem-narrative"
                                    style={{ width: '100%', minHeight: '80px', padding: '8px' }}
                                    placeholder="Enter additional details..."
                                    value={modalData.notes}
                                    onChange={e => setModalData({ ...modalData, notes: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="lem-footer" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
                            <button
                                className="lem-btn-cancel"
                                onClick={handleDeleteStandby}
                                disabled={saving || !vesselSchedules[selectedDate.toISOString().split('T')[0]]}
                                style={{ color: '#ef4444', borderColor: '#ef4444' }}
                            >
                                Remove
                            </button>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="lem-btn-cancel" onClick={() => setSelectedDate(null)} disabled={saving}>Cancel</button>
                                <button className="lem-btn-submit" onClick={handleSaveStandby} disabled={saving || !modalData.reasonId}>
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
