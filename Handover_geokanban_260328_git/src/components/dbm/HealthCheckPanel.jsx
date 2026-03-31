import React from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export default function HealthCheckPanel({ results, running, onRun }) {
    return (
        <div className="mt-6 bg-white/50 backdrop-blur-md rounded-2xl p-6 border border-white shadow-sm overflow-x-auto transition-all duration-500">
            <div className="health-header mb-8">
                <h3 className="text-xl font-manrope font-extrabold text-on-surface uppercase">System Integrity Check</h3>
                <p className="text-xs font-bold text-on-surface/40 mt-1">Validates the entire data pipeline and security policies.</p>
                <button
                    className="mt-6 bg-primary text-white px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2"
                    onClick={onRun}
                    disabled={running}
                >
                    <RefreshCw size={14} className={running ? 'animate-spin' : ''} />
                    {running ? 'Running Check...' : 'Run Diagnostics'}
                </button>
            </div>
            {results && (
                <div className="space-y-3">
                    {results.map((check, i) => (
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
            {!results && !running && (
                <div className="text-center p-12 text-on-surface/20 font-bold uppercase tracking-widest text-[10px]">
                    Click "Run Diagnostics" to validate the system
                </div>
            )}
        </div>
    );
}
