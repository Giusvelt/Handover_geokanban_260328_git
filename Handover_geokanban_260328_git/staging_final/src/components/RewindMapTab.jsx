import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import VesselMap from './VesselMap';
import { useData } from '../context/DataContext';
import { 
    Play, Pause, FastForward, Calendar as CalendarIcon, 
    Download, AlertCircle, ArrowLeft, ArrowRight, History,
    Clock, Database, Map as MapIcon
} from 'lucide-react';
import '../logbook-writer.css';
import SectionHeader from './SectionHeader';

const SPEEDS = [
    { level: 1, label: '1x (15 min/s)', minPerTick: 15 },
    { level: 2, label: '2x (30 min/s)', minPerTick: 30 },
    { level: 3, label: '3x (1 hr/s)', minPerTick: 60 },
    { level: 4, label: '4x (3 hr/s)', minPerTick: 180 },
    { level: 5, label: '5x (6 hr/s)', minPerTick: 360 }
];

export default function RewindMapTab() {
    const { geofences, vessels } = useData();

    // UI selections
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 3);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    // State
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [trackingData, setTrackingData] = useState([]);

    // Playback state
    const [playing, setPlaying] = useState(false);
    const [speedLevel, setSpeedLevel] = useState(1);
    const [virtualTime, setVirtualTime] = useState(null);
    const [playbackDirection, setPlaybackDirection] = useState('forward');

    const maxTime = useRef(null);
    const minTime = useRef(null);
    const timerRef = useRef(null);

    const handleLoadData = async () => {
        setLoading(true);
        setErrorMsg(null);
        setPlaying(false);
        setTrackingData([]);
        setVirtualTime(null);

        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const diffDays = (end - start) / (1000 * 60 * 60 * 24);
            if (diffDays > 31) {
                throw new Error("Date range exceeds 31 days.");
            }
            if (end < start) {
                throw new Error("End date must be after start date.");
            }

            const { data, error } = await supabase
                .from('vessel_tracking')
                .select('vessel_id, mmsi, lat, lon, heading, speed, status, timestamp')
                .gte('timestamp', start.toISOString())
                .lte('timestamp', end.toISOString())
                .order('timestamp', { ascending: true });

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error("No tracking data found.");
            }

            setTrackingData(data);
            const firstTime = new Date(data[0].timestamp).getTime();
            const lastTime = new Date(data[data.length - 1].timestamp).getTime();

            maxTime.current = lastTime;
            minTime.current = firstTime;
            setVirtualTime(playbackDirection === 'backward' ? lastTime : firstTime);

        } catch (err) {
            setErrorMsg(err.message || 'Error fetching data');
        } finally {
            setLoading(false);
        }
    };

    const currentPositions = useMemo(() => {
        if (!trackingData.length || !virtualTime) return [];
        const latest = {};
        for (let i = 0; i < trackingData.length; i++) {
            const row = trackingData[i];
            const t = new Date(row.timestamp).getTime();
            if (t > virtualTime) break;
            latest[row.vessel_id] = row;
        }
        return Object.values(latest).map(pos => {
            const v = vessels?.find(v => v.id === pos.vessel_id);
            return {
                ...pos,
                vessel: v ? v.name : (pos.mmsi || 'Unknown'),
                vessel_type: v ? v.vessel_type : 'Unknown',
            };
        });
    }, [trackingData, virtualTime, vessels]);

    useEffect(() => {
        if (playing) {
            timerRef.current = setInterval(() => {
                setVirtualTime(prevTime => {
                    if (!prevTime || !minTime.current || !maxTime.current) return prevTime;
                    const speedObj = SPEEDS.find(s => s.level === speedLevel);
                    const deltaMs = (speedObj ? speedObj.minPerTick : 15) * 60 * 1000;

                    if (playbackDirection === 'backward') {
                        const nextTime = prevTime - deltaMs;
                        if (nextTime <= minTime.current) { setPlaying(false); return minTime.current; }
                        return nextTime;
                    } else {
                        const nextTime = prevTime + deltaMs;
                        if (nextTime >= maxTime.current) { setPlaying(false); return maxTime.current; }
                        return nextTime;
                    }
                });
            }, 1000);
        } else if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [playing, speedLevel, playbackDirection]);

    const handleProgressChange = (e) => {
        const percent = parseFloat(e.target.value);
        if (!minTime.current || !maxTime.current) return;
        const newTime = minTime.current + ((maxTime.current - minTime.current) * (percent / 100));
        setVirtualTime(newTime);
    };

    let progressPercent = 0;
    if (virtualTime && minTime.current && maxTime.current) {
        const totalDuration = maxTime.current - minTime.current;
        if (totalDuration > 0) progressPercent = ((virtualTime - minTime.current) / totalDuration) * 100;
    }

    return (
        <div className="pt-tab-container pb-10">
            <SectionHeader 
                title="Mission Rewind" 
                subtitle="Historical trajectory analysis & fleet playback" 
                icon={History}
                actions={
                    <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md border border-white/20 rounded-full p-1.5 px-4 shadow-sm">
                        <div className="flex items-center gap-2">
                            <CalendarIcon size={12} className="text-on-surface/40" />
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-on-surface outline-none" />
                            <span className="text-[10px] font-black text-on-surface/20 uppercase">to</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-on-surface outline-none" />
                        </div>
                        <button className="bg-primary text-white text-[9px] font-black uppercase tracking-widest px-6 py-2 rounded-full hover:translate-y-[-1px] transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20" onClick={handleLoadData} disabled={loading}>
                            <Download size={12} /> {loading ? '...' : 'Load'}
                        </button>
                    </div>
                }
            />

            <div className="tab-content mt-4 space-y-4">
                {errorMsg && (
                    <div className="flex items-center gap-2 text-red-500 text-[10px] font-black uppercase tracking-widest bg-red-50 p-3 rounded-xl border border-red-100 animate-in slide-in-from-top-2">
                        <AlertCircle size={14} /> {errorMsg}
                    </div>
                )}
            
                {trackingData.length > 0 && (
                    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-2xl overflow-hidden">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPlaying(!playing)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playing ? 'bg-amber-500 shadow-lg shadow-amber-500/20' : 'bg-primary shadow-lg shadow-primary/20'} text-white`}>
                                    {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                                </button>
                                
                                <button onClick={() => setPlaybackDirection(d => d === 'backward' ? 'forward' : 'backward')} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-300 flex items-center gap-2 hover:bg-slate-700 transition-colors">
                                    {playbackDirection === 'backward' ? <ArrowLeft size={14} className="text-amber-500" /> : <ArrowRight size={14} className="text-green-500" />}
                                    {playbackDirection === 'backward' ? 'Rewind' : 'Forward'}
                                </button>

                                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                                    {SPEEDS.map(s => (
                                        <button key={s.level} onClick={() => setSpeedLevel(s.level)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${speedLevel === s.level ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>
                                            {s.level}x
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-800/50 border border-slate-700 px-5 py-2 rounded-xl flex items-center gap-3">
                                <Clock size={16} className="text-primary" />
                                <div className="flex flex-col">
                                    <span className="text-[14px] font-black text-white leading-none font-mono tracking-wider">
                                        {virtualTime ? new Date(virtualTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                                    </span>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                                        {virtualTime ? new Date(virtualTime).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Select Range'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="relative group px-1">
                            <input type="range" min="0" max="100" step="0.01" value={progressPercent} onChange={handleProgressChange} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-primary" />
                            <div className="flex justify-between mt-2 px-1">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">{new Date(minTime.current).toLocaleDateString()}</span>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">{new Date(maxTime.current).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center gap-6 border-t border-slate-800 pt-4">
                            <div className="flex items-center gap-2">
                                <Database size={12} className="text-slate-600" />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{trackingData.length.toLocaleString()} pts found</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <section className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{currentPositions.length} vessels active</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="relative rounded-2xl overflow-hidden border border-white/50 shadow-xl bg-slate-100" style={{ height: '550px' }}>
                    {trackingData.length === 0 && !loading && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/40 backdrop-blur-sm">
                            <div className="w-16 h-16 rounded-3xl bg-white shadow-xl flex items-center justify-center text-primary mb-4 border border-white">
                                <MapIcon size={32} />
                            </div>
                            <h4 className="text-sm font-manrope font-black text-on-surface uppercase tracking-tight">Map Repository</h4>
                            <p className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest mt-1">Select dates to visualize history</p>
                        </div>
                    )}
                    <VesselMap geofences={geofences} vesselPositions={currentPositions} height="550px" />
                </div>
            </div>
        </div>
    );
}
