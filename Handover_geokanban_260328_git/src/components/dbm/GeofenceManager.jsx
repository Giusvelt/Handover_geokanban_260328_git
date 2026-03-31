import React from 'react';
import { MapPin, Briefcase, Upload, FileDown } from 'lucide-react';
import { ModalField, ActionButtons } from './DBMUtils';

export default function GeofenceManager({ items, onEdit, onDelete, onImport, importing, fileInputRef }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                    <tr className="text-[9px] font-black text-on-surface/20 uppercase tracking-[0.1em]">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Nature</th>
                        <th className="px-4 py-3">Family</th>
                        <th className="px-4 py-3 text-center">Vertices</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={item.id} className="group">
                            <td className="px-4 py-2 bg-white rounded-l-xl text-[9px] font-black text-on-surface/10">{i + 1}</td>
                            <td className="px-4 py-2 bg-white font-manrope font-extrabold text-xs text-on-surface truncate max-w-[200px]">{item.name}</td>
                            <td className="px-4 py-2 bg-white">
                                <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full border border-current/10" style={{ color: item.color, background: `${item.color}10` }}>
                                    {item.nature?.replace('_', ' ')}
                                </span>
                            </td>
                            <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 italic">{item.family || '—'}</td>
                            <td className="px-4 py-2 bg-white text-center text-[10px] font-bold text-on-surface/20">
                                {(() => {
                                    const p = typeof item.polygon_coords === 'string' ? JSON.parse(item.polygon_coords) : item.polygon_coords;
                                    return Array.isArray(p) ? p.length : '—';
                                })()}
                            </td>
                            <td className="px-4 py-2 bg-white rounded-r-xl text-right">
                                <ActionButtons onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function GeofenceForm({ form, setForm }) {
    return (
        <>
            <ModalField label="Name *" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} icon={MapPin} />
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-1 px-1">Nature *</label>
                <select className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20" value={form.nature || ''} onChange={e => setForm({ ...form, nature: e.target.value })}>
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
            <div className="col-span-2 p-3 bg-blue-50/50 rounded-xl flex items-center gap-2 text-[10px] text-blue-500 font-bold border border-blue-100">
                <MapPin size={14} />
                <span>Geofences are polygon-only. Define vertices on the map or via DB import.</span>
            </div>
        </>
    );
}
