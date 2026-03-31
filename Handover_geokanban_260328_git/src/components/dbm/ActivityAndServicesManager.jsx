import React from 'react';
import { Activity, Hash, FileText, Wrench, HeartPulse } from 'lucide-react';
import { ModalField, ActionButtons } from './DBMUtils';

/* ACTIVITY TYPES */
export function ActivityTypeManager({ items, onEdit, onDelete }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                    <tr className="text-[9px] font-black text-on-surface/20 uppercase tracking-[0.1em]">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Activity</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={item.id} className="group">
                            <td className="px-4 py-2 bg-white rounded-l-xl text-[9px] font-black text-on-surface/10">{i + 1}</td>
                            <td className="px-4 py-2 bg-white text-[10px] font-black text-primary">{item.code}</td>
                            <td className="px-4 py-2 bg-white font-extrabold text-xs uppercase tracking-tight">{item.name}</td>
                            <td className="px-4 py-2 bg-white">
                                <span className="text-[8px] font-black uppercase bg-surface-low/30 px-2 py-0.5 rounded-full text-on-surface/40">
                                    {item.category}
                                </span>
                            </td>
                            <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 italic">{item.description || '—'}</td>
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

export function ActivityTypeForm({ form, setForm }) {
    return (
        <>
            <ModalField label="Code *" value={form.code} onChange={v => setForm({...form, code: v.toUpperCase()})} icon={Hash} />
            <ModalField label="Activity Name *" value={form.name} onChange={v => setForm({...form, name: v})} icon={Activity} />
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-1 px-1">Category</label>
                <select className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
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
    );
}

/* SERVICES */
export function ServiceManager({ items, onEdit, onDelete }) {
    return (
        <div className="overflow-x-auto">
             <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                    <tr className="text-[9px] font-black text-on-surface/20 uppercase tracking-[0.1em]">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Service</th>
                        <th className="px-4 py-3">Provider</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={item.id} className="group">
                            <td className="px-4 py-2 bg-white rounded-l-xl text-[9px] font-black text-on-surface/10">{i + 1}</td>
                            <td className="px-4 py-2 bg-white text-[10px] font-black text-secondary">{item.code}</td>
                            <td className="px-4 py-2 bg-white font-extrabold text-xs uppercase tracking-tight">{item.name}</td>
                            <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/60">{item.provider || '—'}</td>
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

export function ServiceForm({ form, setForm }) {
    return (
        <>
            <ModalField label="Code *" value={form.code || ''} onChange={v => setForm({ ...form, code: v.toUpperCase() })} icon={Hash} />
            <ModalField label="Name *" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} icon={Wrench} />
            <ModalField label="Provider" value={form.provider || ''} onChange={v => setForm({ ...form, provider: v })} icon={null} />
        </>
    );
}

/* STANDBY REASONS */
export function StandbyManager({ items, onEdit, onDelete }) {
    return (
        <div className="overflow-x-auto">
             <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                    <tr className="text-[9px] font-black text-on-surface/20 uppercase tracking-[0.1em]">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={item.id} className="group">
                            <td className="px-4 py-2 bg-white rounded-l-xl text-[9px] font-black text-on-surface/10">{i + 1}</td>
                            <td className="px-4 py-2 bg-white text-[10px] font-black text-secondary">{item.code}</td>
                            <td className="px-4 py-2 bg-white font-extrabold text-xs uppercase tracking-tight">{item.name}</td>
                            <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/60">{item.description || '—'}</td>
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

export function StandbyForm({ form, setForm }) {
    return (
        <>
            <ModalField label="Code *" value={form.code || ''} onChange={v => setForm({ ...form, code: v.toUpperCase() })} icon={Hash} />
            <ModalField label="Name *" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} icon={HeartPulse} />
            <ModalField label="Description" value={form.description || ''} onChange={v => setForm({ ...form, description: v })} icon={FileText} />
        </>
    );
}
