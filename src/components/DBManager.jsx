import React, { useState, useEffect } from 'react';
import {
    Ship, MapPin, Activity, Wrench, HeartPulse, Plus, Edit2, Trash2, X, Save,
    Search, CheckCircle, AlertTriangle, XCircle, RefreshCw, FileDown, Upload,
    Building2, Globe, Mail, Phone, Map, Briefcase, FileText, Hash, Box, Info, Anchor
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import { useActivities } from '../hooks/useActivities';
import { useServices } from '../hooks/useServices';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { supabase } from '../lib/supabase';
import SectionHeader from './SectionHeader';

const TABS = [
    { id: 'vessels', label: 'Vessels', icon: Ship, color: '#3b82f6' },
    { id: 'companies', label: 'Companies & Suppliers', icon: Building2, color: '#6366f1' },
    { id: 'geofences', label: 'Geofences', icon: MapPin, color: '#10b981' },
    { id: 'activities', label: 'Activities', icon: Activity, color: '#f59e0b' },
    { id: 'services', label: 'Nautical Services', icon: Wrench, color: '#8b5cf6' },
    { id: 'standby', label: 'Stand-by Reasons', icon: HeartPulse, color: '#f59e0b' },
    { id: 'health', label: 'System Health', icon: HeartPulse, color: '#ef4444' },
];

export default function DBManager() {
    const {
        vessels, geofences,
        addVessel, updateVessel, deleteVessel,
        addGeofence, updateGeofence, deleteGeofence,
        standbyReasons, addStandbyReason, updateStandbyReason, deleteStandbyReason
    } = useData();

    const { activityTypes, addActivityType, updateActivityType, deleteActivityType } = useActivities();
    const { services, addService, updateService, deleteService } = useServices();
    const { results: healthResults, running: healthRunning, runCheck } = useHealthCheck();

    const [companies, setCompanies] = useState([]);
    const [companiesLoading, setCompaniesLoading] = useState(false);

    const fetchCompanies = async () => {
        setCompaniesLoading(true);
        const { data } = await supabase.from('companies').select('*').order('name');
        setCompanies(data || []);
        setCompaniesLoading(false);
    };

    useEffect(() => {
        fetchCompanies();
    }, []);


    const [activeTab, setActiveTab] = useState('vessels');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form, setForm] = useState({});
    const [importing, setImporting] = useState(false);

    const fileInputRef = React.useRef(null);

    const getData = () => {
        let data = [];
        switch (activeTab) {
            case 'vessels': data = vessels || []; break;
            case 'companies': data = companies || []; break;
            case 'geofences': data = geofences || []; break;
            case 'activities': data = activityTypes || []; break;
            case 'services': data = services || []; break;
            case 'standby': data = standbyReasons || []; break;
        }
        if (!search) return data;
        const q = search.toLowerCase();
        return data.filter(item => {
            const name = (item.name || item.full_name || '').toLowerCase();
            const code = (item.code || item.mmsi || item.vat_number || '').toLowerCase();
            return name.includes(q) || code.includes(q);
        });
    };

    const handleAdd = () => { setEditingItem(null); setForm({}); setShowModal(true); };
    const handleEdit = (item) => { setEditingItem(item); setForm({ ...item }); setShowModal(true); };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this item?')) return;
        let result = { success: true };
        switch (activeTab) {
            case 'vessels': result = await deleteVessel(id); break;
            case 'companies': 
                const { error } = await supabase.from('companies').delete().eq('id', id);
                if (!error) fetchCompanies();
                result = { success: !error, error: error?.message };
                break;
            case 'geofences': result = await deleteGeofence(id); break;
            case 'activities': result = await deleteActivityType(id); break;
            case 'services': result = await deleteService(id); break;
            case 'standby': result = await deleteStandbyReason(id); break;
        }
        if (result && !result.success) alert('Error: ' + result.error);
    };

    const handleSave = async () => {
        let result;
        if (editingItem) {
            switch (activeTab) {
                case 'vessels': result = await updateVessel(editingItem.id, form); break;
                case 'companies':
                    const { error: uErr } = await supabase.from('companies').update(form).eq('id', editingItem.id);
                    if (!uErr) fetchCompanies();
                    result = { success: !uErr, error: uErr?.message };
                    break;
                case 'geofences': result = await updateGeofence(editingItem.id, form); break;
                case 'activities': result = await updateActivityType(editingItem.id, form); break;
                case 'services': result = await updateService(editingItem.id, form); break;
                case 'standby': result = await updateStandbyReason(editingItem.id, form); break;
            }
        } else {
            switch (activeTab) {
                case 'vessels': result = await addVessel(form); break;
                case 'companies':
                    const { error: iErr } = await supabase.from('companies').insert([form]);
                    if (!iErr) fetchCompanies();
                    result = { success: !iErr, error: iErr?.message };
                    break;
                case 'geofences': result = await addGeofence(form); break;
                case 'activities': result = await addActivityType(form); break;
                case 'services': result = await addService(form); break;
                case 'standby': result = await addStandbyReason(form); break;
            }
        }
        if (result && !result.success) { alert('Error: ' + result.error); return; }
        setShowModal(false);
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) throw new Error("File is empty");

                // Group by Geofence Name
                const groups = {};
                data.forEach(row => {
                    const name = row.Name || row.name;
                    if (!name) return;
                    if (!groups[name]) groups[name] = [];
                    groups[name].push(row);
                });

                let importedCount = 0;
                for (const name in groups) {
                    const rows = groups[name].sort((a, b) => (a.Vertex || a.vertex || 0) - (b.Vertex || b.vertex || 0));
                    const coords = rows.map(r => [
                        parseFloat(r.Latitude || r.latitude || r.lat),
                        parseFloat(r.Longitude || r.longitude || r.lon)
                    ]).filter(c => !isNaN(c[0]) && !isNaN(c[1]));

                    if (coords.length < 3) {
                        continue;
                    }

                    // Calculate center (approximate centroid)
                    const lat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
                    const lon = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

                    const nature = rows[0].Nature || rows[0].nature || 'general';
                    const family = rows[0].Family || rows[0].family || '';
                    const color = rows[0].Color || rows[0].color || '#3b82f6';

                    const newGeo = {
                        name,
                        nature: nature.toLowerCase(),
                        family,
                        color,
                        lat,
                        lon,
                        polygon_coords: JSON.stringify(coords)
                    };

                    const res = await addGeofence(newGeo);
                    if (res.success) importedCount++;
                }

                alert(`Successfully imported ${importedCount} geofences.`);
                fileInputRef.current.value = "";
            } catch (err) {
                console.error("Import failed:", err);
                alert("Import failed: " + err.message);
            } finally {
                setImporting(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const data = getData();
    const currentTab = TABS.find(t => t.id === activeTab);

    return (
        <div className="dbm-container">
            <SectionHeader 
                title="Database Manager" 
                subtitle="Master data synchronization and system integrity" 
                icon={DatabaseIcon}
                onRefresh={activeTab === 'companies' ? fetchCompanies : null}
                loading={companiesLoading}
            />

            {/* Tab Bar */}
            <div className="dbm-tabs bg-white/50 backdrop-blur-md rounded-[2.5rem] p-2 mb-8 border border-white flex flex-wrap gap-1 shadow-sm">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`
                            flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all
                            ${activeTab === tab.id 
                                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' 
                                : 'text-on-surface/40 hover:text-on-surface hover:bg-white/80'
                            }
                        `}
                        onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] ${activeTab === tab.id ? 'bg-white/20' : 'bg-surface-low/30'}`}>
                            {
                                tab.id === 'vessels' ? (vessels?.length || 0) :
                                tab.id === 'companies' ? (companies?.length || 0) :
                                tab.id === 'geofences' ? (geofences?.length || 0) :
                                tab.id === 'activities' ? (activityTypes?.length || 0) :
                                tab.id === 'health' ? (healthResults ? (healthResults.filter(r => r.status === 'fail').length > 0 ? '!' : 'OK') : '-') :
                                (services?.length || 0)
                            }
                        </span>
                    </button>
                ))}
            </div>

            {/* Health Check Panel */}
            {activeTab === 'health' && (
                <div className="mt-6 bg-white/50 backdrop-blur-md rounded-2xl p-6 border border-white shadow-sm overflow-x-auto transition-all duration-500">
                    <div className="health-header mb-8">
                        <h3 className="text-xl font-manrope font-extrabold text-on-surface uppercase">System Integrity Check</h3>
                        <p className="text-xs font-bold text-on-surface/40 mt-1">Validates the entire data pipeline and security policies.</p>
                        <button
                            className="mt-6 bg-primary text-white px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2"
                            onClick={runCheck}
                            disabled={healthRunning}
                        >
                            <RefreshCw size={14} className={healthRunning ? 'animate-spin' : ''} />
                            {healthRunning ? 'Running Check...' : 'Run Diagnostics'}
                        </button>
                    </div>
                    {healthResults && (
                        <div className="space-y-3">
                            {healthResults.map((check, i) => (
                                <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border ${check.status === 'ok' ? 'bg-green-50/30 border-green-200' : check.status === 'fail' ? 'bg-red-50/30 border-red-200' : 'bg-yellow-50/30 border-yellow-200'}`}>
                                    <div className={check.status === 'ok' ? 'text-green-500' : check.status === 'fail' ? 'text-red-500' : 'text-yellow-500'}>
                                        {check.status === 'ok' && <CheckCircle size={20} />}
                                        {check.status === 'warn' && <AlertTriangle size={20} />}
                                        {check.status === 'fail' && <XCircle size={20} />}
                                    </div>
                                    <div>
                                        <div className="text-sm font-extrabold text-on-surface uppercase tracking-tight">{check.name}</div>
                                        <div className="text-[11px] font-bold text-on-surface/40 italic">{check.detail}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!healthResults && !healthRunning && (
                        <div className="health-empty">
                            Click "Run Health Check" to validate the system
                        </div>
                    )}
                </div>
            )}

            {activeTab !== 'health' && (
                <div className="bg-white/50 backdrop-blur-md rounded-2xl p-4 lg:p-6 border border-white shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-surface-low/30 shadow-inner w-full md:max-w-xs">
                            <Search size={14} className="text-on-surface/20" />
                            <input
                                type="text"
                                placeholder={`Search ${currentTab?.label}...`}
                                className="bg-transparent border-none outline-none text-[10px] font-bold text-on-surface w-full placeholder:text-on-surface/20"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                             {activeTab === 'geofences' && (
                                <>
                                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx, .xls" onChange={handleImportExcel} />
                                    <button className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-surface-low/30 px-4 py-2 rounded-full text-[9px] font-black text-on-surface/40 uppercase tracking-widest transition-all" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                                        <Upload size={14} /> {importing ? 'Importing...' : 'Import Excel'}
                                    </button>
                                    <a
                                        href="/templates/geofence_import_template.xlsx"
                                        download
                                        className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-surface-low/30 px-4 py-2 rounded-full text-[9px] font-black text-on-surface/40 uppercase tracking-widest transition-all"
                                        style={{ textDecoration: 'none', color: 'inherit' }}
                                    >
                                        <FileDown size={14} /> Template
                                    </a>
                                </>
                            )}
                            <button className="bg-primary text-white px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2 hover:translate-y-[-2px] transition-all" onClick={handleAdd}>
                                <Plus size={14} /> Add {currentTab?.label.replace(/s$/, '').split(' ')[0]}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-separate border-spacing-y-1">
                            <thead>
                                <tr className="text-[9px] font-black text-on-surface/20 uppercase tracking-[0.1em]">
                                    <th className="px-4 py-3">#</th>
                                    {activeTab === 'companies' && (
                                        <>
                                            <th className="px-4 py-3">Company</th>
                                            <th className="px-4 py-3">VAT / P.IVA</th>
                                            <th className="px-4 py-3">Location</th>
                                            <th className="px-4 py-3">Type</th>
                                        </>
                                    )}
                                    {activeTab === 'vessels' && (
                                        <>
                                            <th className="px-4 py-3">Vessel Name</th>
                                            <th className="px-4 py-3">MMSI</th>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3">Company</th>
                                        </>
                                    )}
                                    {activeTab === 'geofences' && (
                                        <>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3">Nature</th>
                                            <th className="px-4 py-3">Family</th>
                                            <th className="px-4 py-3">Color</th>
                                            <th className="px-4 py-3 text-center">Vertices</th>
                                        </>
                                    )}
                                    {activeTab === 'activities' && (
                                        <>
                                            <th className="px-4 py-3">Code</th>
                                            <th className="px-4 py-3">Activity</th>
                                            <th className="px-4 py-3">Category</th>
                                            <th className="px-4 py-3">Description</th>
                                        </>
                                    )}
                                    {activeTab === 'services' && (
                                        <>
                                            <th className="px-4 py-3">Code</th>
                                            <th className="px-4 py-3">Service</th>
                                            <th className="px-4 py-3">Provider</th>
                                        </>
                                    )}
                                    {activeTab === 'standby' && (
                                        <>
                                            <th className="px-4 py-3">Code</th>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3">Description</th>
                                        </>
                                    )}
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.length === 0 ? (
                                    <tr><td colSpan={10} className="dbm-empty p-8 text-center text-on-surface/20 font-bold">No {currentTab?.label.toLowerCase()} found</td></tr>
                                ) : data.map((item, i) => (
                                    <tr key={item.id} className="group">
                                        <td className="px-4 py-2 bg-white rounded-l-xl text-[9px] font-black text-on-surface/10">{i + 1}</td>
                                        
                                        {activeTab === 'vessels' && (
                                            <>
                                                <td className="px-4 py-2 bg-white font-manrope font-extrabold text-xs text-on-surface">{item.name}</td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 font-mono">{item.mmsi}</td>
                                                <td className="px-4 py-2 bg-white text-[9px] font-black text-on-surface/20 uppercase italic">{item.vessel_type}</td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-primary truncate max-w-[120px]">{companies?.find(c => c.id === item.company_id)?.name || '—'}</td>
                                            </>
                                        )}
                                        {activeTab === 'companies' && (
                                            <>
                                                <td className="px-4 py-2 bg-white font-manrope font-extrabold text-xs text-on-surface truncate max-w-[200px]">{item.name}</td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 uppercase font-mono">{item.vat_number || '—'}</td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 italic">{item.city || '—'}</td>
                                                <td className="px-4 py-2 bg-white">
                                                    <div className="flex gap-1">
                                                        {item.is_shipowner && <span className="text-[7px] font-black uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">Owner</span>}
                                                        {item.is_supplier && <span className="text-[7px] font-black uppercase bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">Supplier</span>}
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                        {activeTab === 'geofences' && (
                                            <>
                                                <td className="px-4 py-2 bg-white font-manrope font-extrabold text-xs text-on-surface truncate max-w-[200px]">{item.name}</td>
                                                <td className="px-4 py-2 bg-white">
                                                    <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full border border-current/10" style={{ color: item.color, background: `${item.color}10` }}>
                                                        {item.nature?.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 italic">{item.family || '—'}</td>
                                                <td className="px-4 py-2 bg-white">
                                                    <div className="flex items-center gap-2 text-[9px] font-black opacity-30">
                                                        <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                                                        {item.color}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 bg-white text-center text-[10px] font-bold text-on-surface/20">
                                                    {(() => {
                                                        const p = typeof item.polygon_coords === 'string' ? JSON.parse(item.polygon_coords) : item.polygon_coords;
                                                        return Array.isArray(p) ? p.length : '—';
                                                    })()}
                                                </td>
                                            </>
                                        )}
                                        {activeTab === 'activities' && (
                                            <>
                                                <td className="px-4 py-2 bg-white text-[10px] font-black text-primary">{item.code}</td>
                                                <td className="px-4 py-2 bg-white font-extrabold text-xs uppercase tracking-tight">{item.name}</td>
                                                <td className="px-4 py-2 bg-white">
                                                    <span className="text-[8px] font-black uppercase bg-surface-low/30 px-2 py-0.5 rounded-full text-on-surface/40">
                                                        {item.category}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 italic">{item.description || '—'}</td>
                                            </>
                                        )}
                                        {activeTab === 'services' && (
                                            <>
                                                <td className="px-4 py-2 bg-white text-[10px] font-black text-secondary">{item.code}</td>
                                                <td className="px-4 py-2 bg-white font-extrabold text-xs uppercase tracking-tight">{item.name}</td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/60">{item.provider || '—'}</td>
                                            </>
                                        )}
                                        {activeTab === 'standby' && (
                                            <>
                                                <td className="px-4 py-2 bg-white text-[10px] font-black text-secondary">{item.code}</td>
                                                <td className="px-4 py-2 bg-white font-extrabold text-xs uppercase tracking-tight">{item.name}</td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/60">{item.description || '—'}</td>
                                            </>
                                        )}
                                        <td className="px-4 py-2 bg-white rounded-r-xl text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button onClick={() => handleEdit(item)} className="w-6 h-6 rounded-full bg-surface-low/30 flex items-center justify-center text-on-surface/20 hover:bg-primary hover:text-white transition-all">
                                                    <Edit2 size={12} />
                                                </button>
                                                <button onClick={() => handleDelete(item.id)} className="w-6 h-6 rounded-full bg-surface-low/30 flex items-center justify-center text-on-surface/20 hover:bg-red-500 hover:text-white transition-all">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Premium Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-md" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-white overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-surface-low/30 flex items-center justify-between bg-gradient-to-r from-surface-low/20 to-transparent">
                            <div>
                                <h3 className="text-lg font-manrope font-black text-on-surface uppercase tracking-tight">
                                    {editingItem ? 'Edit' : 'Create'} {currentTab?.label.replace(/s$/, '').split(' ')[0]}
                                </h3>
                                <p className="text-[9px] font-black text-on-surface/30 uppercase tracking-widest mt-1">Master Data Registry Entry</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-surface-low/30 flex items-center justify-center text-on-surface/40 hover:bg-white transition-all shadow-sm">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 max-h-[70vh] overflow-y-auto grid grid-cols-2 gap-4 custom-scrollbar">
                            {activeTab === 'vessels' && (
                                <>
                                    <ModalField label="MMSI *" value={form.mmsi} onChange={v => setForm({...form, mmsi: v})} icon={Hash} />
                                    <ModalField label="Vessel Name *" value={form.name} onChange={v => setForm({...form, name: v})} icon={Ship} />
                                    <ModalField label="IMO" value={form.imo} onChange={v => setForm({...form, imo: v})} icon={Info} />
                                    <ModalField label="Type" value={form.vessel_type} onChange={v => setForm({...form, vessel_type: v})} icon={Anchor} />
                                    <ModalField label="Avg Cargo (tons)" value={form.avg_cargo} onChange={v => setForm({...form, avg_cargo: Number(v)})} icon={Box} type="number" />
                                    <ModalField label="Cycle (hours)" value={form.standard_cycle_hours} onChange={v => setForm({...form, standard_cycle_hours: Number(v)})} icon={RefreshCw} type="number" />
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-2 px-1">Owning Company (Armatore)</label>
                                        <select 
                                            className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none"
                                            value={form.company_id || ''}
                                            onChange={e => setForm({...form, company_id: e.target.value || null})}
                                        >
                                            <option value="">Generic / Undefined</option>
                                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-2 grid grid-cols-3 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-1 px-1">Loading Site</label>
                                            <select className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-xs font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none" value={form.default_loading_id || ''} onChange={e => setForm({ ...form, default_loading_id: e.target.value || null })}>
                                                <option value="">— None —</option>
                                                {(geofences || []).filter(g => g.nature === 'loading_site').map(g => (
                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-1 px-1">Unloading Site</label>
                                            <select className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-xs font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none" value={form.default_unloading_id || ''} onChange={e => setForm({ ...form, default_unloading_id: e.target.value || null })}>
                                                <option value="">— None —</option>
                                                {(geofences || []).filter(g => g.nature === 'unloading_site').map(g => (
                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-1 px-1">Base Port</label>
                                            <select className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-xs font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none" value={form.default_base_id || ''} onChange={e => setForm({ ...form, default_base_id: e.target.value || null })}>
                                                <option value="">— None —</option>
                                                {(geofences || []).filter(g => g.nature === 'base_port').map(g => (
                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTab === 'companies' && (
                                <>
                                    <div className="col-span-2">
                                        <ModalField label="Company Short Name (Public) *" value={form.name} onChange={v => setForm({...form, name: v})} icon={Building2} />
                                    </div>
                                    <ModalField label="Full Business Name" value={form.full_name} onChange={v => setForm({...form, full_name: v})} icon={FileText} />
                                    <ModalField label="VAT Number (P.IVA)" value={form.vat_number} onChange={v => setForm({...form, vat_number: v})} icon={Hash} />
                                    
                                    <div className="col-span-2 mt-2 pt-2 border-t border-surface-low/30">
                                        <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2">Location & Contact</p>
                                    </div>
                                    <ModalField label="Address" value={form.address} onChange={v => setForm({...form, address: v})} icon={Map} />
                                    <div className="grid grid-cols-2 gap-3 col-span-1">
                                        <ModalField label="City" value={form.city} onChange={v => setForm({...form, city: v})} icon={Globe} />
                                        <ModalField label="ZIP" value={form.zip} onChange={v => setForm({...form, zip: v})} icon={Hash} />
                                    </div>
                                    <ModalField label="Email" value={form.email} onChange={v => setForm({...form, email: v})} icon={Mail} />
                                    <ModalField label="Phone" value={form.phone} onChange={v => setForm({...form, phone: v})} icon={Phone} />

                                    <div className="col-span-2 flex items-center gap-6 mt-2 p-3 bg-surface-low/10 rounded-xl border border-surface-low/20">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" className="w-4 h-4 rounded border-surface-low/50 text-primary focus:ring-primary/20" checked={form.is_shipowner || false} onChange={e => setForm({...form, is_shipowner: e.target.checked})} />
                                            <span className="text-[10px] font-black text-on-surface uppercase tracking-tight">Shipowner</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" className="w-4 h-4 rounded border-surface-low/50 text-secondary focus:ring-secondary/20" checked={form.is_supplier || false} onChange={e => setForm({...form, is_supplier: e.target.checked})} />
                                            <span className="text-[10px] font-black text-on-surface uppercase tracking-tight">Supplier</span>
                                        </label>
                                    </div>
                                </>
                            )}

                            {activeTab === 'geofences' && (
                                <>
                                    <ModalField label="Name *" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} icon={MapPin} />
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-1 px-1">Nature *</label>
                                        <select className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none" value={form.nature || ''} onChange={e => setForm({ ...form, nature: e.target.value })}>
                                            <option value="">Select...</option>
                                            <option value="loading_site">Loading Site</option>
                                            <option value="unloading_site">Unloading Site</option>
                                            <option value="base_port">Base Port</option>
                                            <option value="anchorage">Anchorage</option>
                                            <option value="transit">Transit</option>
                                            <option value="mooring">Mooring</option>
                                            <option value="port">Port</option>
                                            <option value="rada">Rada</option>
                                            <option value="general">General</option>
                                        </select>
                                    </div>
                                    <ModalField label="Family" value={form.family || ''} onChange={v => setForm({ ...form, family: v })} icon={Briefcase} />
                                    <ModalField label="Color" value={form.color || '#3b82f6'} onChange={v => setForm({ ...form, color: v })} icon={null} type="color" />
                                    <div className="dbm-info-box col-span-2 p-3 bg-blue-50/50 rounded-xl flex items-center gap-2 text-[10px] text-blue-500 font-bold border border-blue-100">
                                        <MapPin size={14} />
                                        <span>Geofences are polygon-only. Define vertices on the map or via DB import.</span>
                                    </div>
                                </>
                            )}

                            {activeTab === 'activities' && (
                                <>
                                    <ModalField label="Code *" value={form.code} onChange={v => setForm({...form, code: v.toUpperCase()})} icon={Hash} />
                                    <ModalField label="Activity Name *" value={form.name} onChange={v => setForm({...form, name: v})} icon={Activity} />
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-1 px-1">Category</label>
                                        <select className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
                                            <option value="">Select...</option>
                                            <option value="navigation">Navigation</option>
                                            <option value="mooring">Mooring</option>
                                            <option value="cargo">Cargo</option>
                                            <option value="supply">Supply</option>
                                            <option value="maintenance">Maintenance</option>
                                        </select>
                                    </div>
                                    <ModalField label="Description" value={form.description} onChange={v => setForm({...form, description: v})} icon={FileText} />
                                </>
                            )}
                            {activeTab === 'services' && (
                                <>
                                    <ModalField label="Code *" value={form.code || ''} onChange={v => setForm({ ...form, code: v.toUpperCase() })} icon={Hash} />
                                    <ModalField label="Name *" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} icon={Wrench} />
                                    <ModalField label="Provider" value={form.provider || ''} onChange={v => setForm({ ...form, provider: v })} icon={Building2} />
                                </>
                            )}
                            {activeTab === 'standby' && (
                                <>
                                    <ModalField label="Code *" value={form.code || ''} onChange={v => setForm({ ...form, code: v.toUpperCase() })} icon={Hash} />
                                    <ModalField label="Name *" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} icon={HeartPulse} />
                                    <ModalField label="Description" value={form.description || ''} onChange={v => setForm({ ...form, description: v })} icon={FileText} />
                                </>
                            )}
                        </div>

                        <div className="p-6 bg-surface-low/20 border-t border-surface-low/30 flex items-center justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2 rounded-full text-[9px] font-black text-on-surface/40 uppercase tracking-widest hover:bg-white transition-all">Cancel</button>
                            <button onClick={handleSave} className="bg-primary text-white px-8 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2 hover:translate-y-[-2px] transition-all">
                                <Save size={14} /> {editingItem ? 'Update' : 'Register'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const ModalField = ({ label, value, onChange, icon: Icon, type = "text" }) => (
    <div className="flex flex-col">
        <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest mb-2 px-1">{label}</label>
        <div className="relative flex items-center">
            {Icon && <Icon size={16} className="absolute left-5 text-on-surface/20" />}
            <input 
                type={type} 
                className={`w-full bg-surface-low/20 border-none rounded-2xl ${Icon ? 'pl-12' : 'px-5'} py-4 text-sm font-extrabold text-on-surface placeholder:text-on-surface/10 outline-none focus:ring-2 ring-primary/20 transition-all`}
                value={value || ''}
                onChange={e => onChange(e.target.value)}
            />
        </div>
    </div>
);

const DatabaseIcon = (props) => (
    <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>
    </svg>
);
