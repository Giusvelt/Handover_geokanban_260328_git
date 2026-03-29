import React from 'react';
import { Building2, FileText, Hash, Globe, Mail, Phone } from 'lucide-react';
import { ModalField, ActionButtons } from './DBMUtils';

export default function CompanyManager({ items, onEdit, onDelete }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                    <tr className="text-[9px] font-black text-on-surface/20 uppercase tracking-[0.1em]">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">VAT / P.IVA</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={item.id} className="group">
                            <td className="px-4 py-2 bg-white rounded-l-xl text-[9px] font-black text-on-surface/10">{i + 1}</td>
                            <td className="px-4 py-2 bg-white font-manrope font-extrabold text-xs text-on-surface truncate max-w-[200px]">{item.name}</td>
                            <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 uppercase font-mono">{item.vat_number || '—'}</td>
                            <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 italic">{item.city || '—'}</td>
                            <td className="px-4 py-2 bg-white">
                                <div className="flex gap-1">
                                    {item.is_shipowner && <span className="text-[7px] font-black uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">Owner</span>}
                                    {item.is_supplier && <span className="text-[7px] font-black uppercase bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">Supplier</span>}
                                </div>
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

export function CompanyForm({ form, setForm }) {
    return (
        <>
            <div className="col-span-2">
                <ModalField label="Company Short Name (Public) *" value={form.name} onChange={v => setForm({...form, name: v})} icon={Building2} />
            </div>
            <ModalField label="Full Business Name" value={form.full_name} onChange={v => setForm({...form, full_name: v})} icon={FileText} />
            <ModalField label="VAT Number (P.IVA)" value={form.vat_number} onChange={v => setForm({...form, vat_number: v})} icon={Hash} />
            
            <div className="col-span-2 mt-2 pt-2 border-t border-surface-low/30">
                <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2">Location & Contact</p>
            </div>
            <ModalField label="Address" value={form.address} onChange={v => setForm({...form, address: v})} icon={Globe} />
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
    );
}
