import React from 'react';

export const ModalField = ({ label, value, onChange, icon: Icon, type = "text" }) => (
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

export const ActionButtons = ({ onEdit, onDelete }) => (
    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="w-6 h-6 rounded-full bg-surface-low/30 flex items-center justify-center text-on-surface/20 hover:bg-primary hover:text-white transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
        </button>
        <button onClick={onDelete} className="w-6 h-6 rounded-full bg-surface-low/30 flex items-center justify-center text-on-surface/20 hover:bg-red-500 hover:text-white transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
        </button>
    </div>
);
