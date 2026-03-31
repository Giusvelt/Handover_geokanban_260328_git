import React from 'react';
import { Ship, Hash, Info, Anchor, RefreshCw, Box } from 'lucide-react';
import { ModalField } from './DBMUtils';

export default function VesselManager({ items, companies, perms, onEdit, onDelete, form, setForm }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                    <tr className="text-[9px] font-black text-on-surface/20 uppercase tracking-[0.1em]">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Vessel Name</th>
                        <th className="px-4 py-3">MMSI</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={item.id} className="group">
                            <td className="px-4 py-2 bg-white rounded-l-xl text-[9px] font-black text-on-surface/10">{i + 1}</td>
                            <td className="px-4 py-2 bg-white font-manrope font-extrabold text-xs text-on-surface">{item.name}</td>
                            <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 font-mono">{item.mmsi}</td>
                            <td className="px-4 py-2 bg-white text-[9px] font-black text-on-surface/20 uppercase italic">{item.vessel_type}</td>
                            <td className="px-4 py-2 bg-white text-[10px] font-bold text-primary truncate max-w-[120px]">
                                {companies?.find(c => c.id === item.company_id)?.name || '—'}
                            </td>
                            <td className="px-4 py-2 bg-white rounded-r-xl text-right">
                                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => onEdit(item)} className="w-6 h-6 rounded-full bg-surface-low/30 flex items-center justify-center text-on-surface/20 hover:bg-primary hover:text-white transition-all">
                                        <Ship size={12} />
                                    </button>
                                    <button onClick={() => onDelete(item.id)} className="w-6 h-6 rounded-full bg-surface-low/30 flex items-center justify-center text-on-surface/20 hover:bg-red-500 hover:text-white transition-all">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function VesselForm({ form, setForm, companies, geofences }) {
    return (
        <>
            <ModalField label="MMSI *" value={form.mmsi} onChange={v => setForm({...form, mmsi: v})} icon={Hash} />
            <ModalField label="Vessel Name *" value={form.name} onChange={v => setForm({...form, name: v})} icon={Ship} />
            <ModalField label="IMO" value={form.imo} onChange={v => setForm({...form, imo: v})} icon={Info} />
            <ModalField label="Type" value={form.vessel_type} onChange={v => setForm({...form, vessel_type: v})} icon={Anchor} />
            <ModalField label="Avg Cargo (tons)" value={form.avg_cargo} onChange={v => setForm({...form, avg_cargo: Number(v)})} icon={Box} type="number" />
            <ModalField label="Cycle (hours)" value={form.standard_cycle_hours} onChange={v => setForm({...form, standard_cycle_hours: Number(v)})} icon={RefreshCw} type="number" />
            
            <div className="col-span-2">
                <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-2 px-1">Owning Company</label>
                <select 
                    className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20"
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
                    <select className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-xs font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20" value={form.default_loading_id || ''} onChange={e => setForm({ ...form, default_loading_id: e.target.value || null })}>
                        <option value="">— None —</option>
                        {(geofences || []).filter(g => g.nature === 'loading_site').map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                </div>
                {/* ... existing logic for unloading and base ... */}
            </div>
        </>
    );
}

// Helper icons needed inside manager tables
const Trash2 = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
);
