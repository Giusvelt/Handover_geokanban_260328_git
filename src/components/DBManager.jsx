import React, { useState, useEffect } from 'react';
import {
    Ship, MapPin, Activity, Wrench, HeartPulse, Plus, X, Save,
    Search, RefreshCw, FileDown, Upload,
    Building2, Database
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import { useActivities } from '../hooks/useActivities';
import { useServices } from '../hooks/useServices';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { supabase } from '../lib/supabase';
import SectionHeader from './SectionHeader';

// New Modular Sub-components
import VesselManager, { VesselForm } from './dbm/VesselManager';
import CompanyManager, { CompanyForm } from './dbm/CompanyManager';
import GeofenceManager, { GeofenceForm } from './dbm/GeofenceManager';
import { ActivityTypeManager, ActivityTypeForm, ServiceManager, ServiceForm, StandbyManager, StandbyForm } from './dbm/ActivityAndServicesManager';
import HealthCheckPanel from './dbm/HealthCheckPanel';

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
    const [activeTab, setActiveTab] = useState('vessels');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form, setForm] = useState({});
    const [importing, setImporting] = useState(false);

    const fileInputRef = React.useRef(null);

    const fetchCompanies = async () => {
        setCompaniesLoading(true);
        const { data } = await supabase.from('companies').select('*').order('name');
        setCompanies(data || []);
        setCompaniesLoading(false);
    };

    useEffect(() => {
        fetchCompanies();
    }, []);

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

                    if (coords.length < 3) continue;

                    const lat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
                    const lon = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
                    const nature = rows[0].Nature || rows[0].nature || 'general';

                    const newGeo = {
                        name,
                        nature: nature.toLowerCase(),
                        family: rows[0].Family || rows[0].family || '',
                        color: rows[0].Color || rows[0].color || '#3b82f6',
                        lat, lon,
                        polygon_coords: JSON.stringify(coords)
                    };

                    const res = await addGeofence(newGeo);
                    if (res.success) importedCount++;
                }

                alert(`Successfully imported ${importedCount} geofences.`);
                fileInputRef.current.value = "";
            } catch (err) {
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
                icon={Database}
                onRefresh={activeTab === 'companies' ? fetchCompanies : null}
                loading={companiesLoading}
            />

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

            {activeTab === 'health' ? (
                <HealthCheckPanel results={healthResults} running={healthRunning} onRun={runCheck} />
            ) : (
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
                                    <a href="/templates/geofence_import_template.xlsx" download className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-surface-low/30 px-4 py-2 rounded-full text-[9px] font-black text-on-surface/40 uppercase tracking-widest transition-all" style={{ textDecoration: 'none', color: 'inherit' }}>
                                        <FileDown size={14} /> Template
                                    </a>
                                </>
                            )}
                            <button className="bg-primary text-white px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2 hover:translate-y-[-2px] transition-all" onClick={handleAdd}>
                                <Plus size={14} /> Add {currentTab?.label.replace(/s$/, '').split(' ')[0]}
                            </button>
                        </div>
                    </div>

                    {activeTab === 'vessels' && <VesselManager items={data} companies={companies} onEdit={handleEdit} onDelete={handleDelete} />}
                    {activeTab === 'companies' && <CompanyManager items={data} onEdit={handleEdit} onDelete={handleDelete} />}
                    {activeTab === 'geofences' && <GeofenceManager items={data} onEdit={handleEdit} onDelete={handleDelete} />}
                    {activeTab === 'activities' && <ActivityTypeManager items={data} onEdit={handleEdit} onDelete={handleDelete} />}
                    {activeTab === 'services' && <ServiceManager items={data} onEdit={handleEdit} onDelete={handleDelete} />}
                    {activeTab === 'standby' && <StandbyManager items={data} onEdit={handleEdit} onDelete={handleDelete} />}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 text-on-surface">
                    <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-md" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-white overflow-hidden">
                        <div className="p-6 border-b border-surface-low/30 flex items-center justify-between bg-gradient-to-r from-surface-low/20 to-transparent">
                            <div>
                                <h3 className="text-lg font-manrope font-black text-on-surface uppercase tracking-tight">{editingItem ? 'Edit' : 'Create'} {currentTab?.label.replace(/s$/, '').split(' ')[0]}</h3>
                                <p className="text-[9px] font-black text-on-surface/30 uppercase tracking-widest mt-1">Master Data Registry Entry</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-surface-low/30 flex items-center justify-center text-on-surface/40 hover:bg-white transition-all shadow-sm">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 max-h-[70vh] overflow-y-auto grid grid-cols-2 gap-4 custom-scrollbar">
                            {activeTab === 'vessels' && <VesselForm form={form} setForm={setForm} companies={companies} geofences={geofences} />}
                            {activeTab === 'companies' && <CompanyForm form={form} setForm={setForm} />}
                            {activeTab === 'geofences' && <GeofenceForm form={form} setForm={setForm} />}
                            {activeTab === 'activities' && <ActivityTypeForm form={form} setForm={setForm} />}
                            {activeTab === 'services' && <ServiceForm form={form} setForm={setForm} />}
                            {activeTab === 'standby' && <StandbyForm form={form} setForm={setForm} />}
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
