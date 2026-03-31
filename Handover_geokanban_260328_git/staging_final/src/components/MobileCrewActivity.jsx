import React, { useState, useRef } from 'react';
import { 
  Ship, MapPin, Clock, ShieldCheck, Wind, MessageSquare,
  Edit3, Save, Send, X, AlertCircle, ChevronRight
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useUserProfile } from '../hooks/useUserProfile';
import LogbookEntryModal from './LogbookEntryModal';
import ActivityChatModal from './ActivityChatModal';

const formatTime = (ts) => {
  if (!ts) return '--:--';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const activityColor = (activity) => {
  const map = {
    'Loading': '#10b981', 'Unloading': '#f59e0b',
    'Navigation': '#3b82f6', 'Anchorage': '#8b5cf6',
    'Stand-by': '#64748b', 'Port Operations': '#06b6d4', 'Mooring': '#14b8a6'
  };
  return map[activity] || '#94a3b8';
};

export default function MobileCrewActivity() {
  const { activities, loading, fetchActivities } = useData();
  const { profile } = useUserProfile();

  const [menuActivity, setMenuActivity] = useState(null);
  const [pressingId, setPressingId] = useState(null);
  const [logbookModal, setLogbookModal] = useState(null);
  const [chatModal, setChatModal] = useState(null);
  const longPressTimer = useRef(null);
  const pressStartTime = useRef(null);

  const myActivities = (activities || [])
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    .slice(0, 20);

  // ─── Long Press Handlers ───────────────────────────────────────
  const handleTouchStart = (activity, e) => {
    pressStartTime.current = Date.now();
    setPressingId(activity.id);
    
    longPressTimer.current = setTimeout(() => {
      setMenuActivity(activity);
      setPressingId(null);
      if (window.navigator.vibrate) window.navigator.vibrate([40, 10, 40]);
    }, 550);
  };

  const handleTouchEnd = (e) => {
    const duration = Date.now() - (pressStartTime.current || 0);
    clearTimeout(longPressTimer.current);
    // If it was a short tap, don't open menu - just clear pressing state
    if (duration < 550) setPressingId(null);
  };

  const handleTouchMove = () => {
    clearTimeout(longPressTimer.current);
    setPressingId(null);
  };

  // ─── Loading State ─────────────────────────────────────────────
  if (loading && !activities.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-on-surface/40 font-black text-xs uppercase tracking-widest">Caricamento attività...</p>
      </div>
    );
  }

  if (!myActivities.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-surface-low flex items-center justify-center">
          <AlertCircle size={28} className="text-on-surface/20" />
        </div>
        <div>
          <p className="font-manrope font-extrabold text-on-surface/40">Nessuna attività trovata</p>
          <p className="text-xs text-on-surface/20 mt-1">Le attività della tua nave appariranno qui</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12">
      {/* Instruction hint */}
      <div className="flex items-center gap-2 mb-5 px-1">
        <div className="flex-1 h-px bg-surface-low/50" />
        <p className="text-[9px] font-black text-on-surface/25 uppercase tracking-widest whitespace-nowrap">
          Tieni premuto per gestire
        </p>
        <div className="flex-1 h-px bg-surface-low/50" />
      </div>

      <div className="space-y-3">
        {myActivities.map((a) => {
          const isActive = a.status === 'in-progress';
          const isSubmitted = a.logbookStatus === 'submitted' || a.logbookStatus === 'approved';
          const isPressing = pressingId === a.id;
          const color = activityColor(a.activity);

          return (
            <div
              key={a.id}
              onTouchStart={(e) => handleTouchStart(a, e)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
              style={{ transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
              className={`
                relative bg-surface-lowest rounded-2xl overflow-hidden shadow-sm border border-surface-low/40
                ${isPressing 
                  ? 'scale-[0.96] shadow-lg shadow-primary/15 brightness-95' 
                  : 'scale-100'
                }
                ${isActive ? 'ring-2 ring-primary/25' : ''}
              `}
            >
              {/* Left accent bar */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                style={{ backgroundColor: color }}
              />

              <div className="pl-4 pr-4 py-4 ml-1">
                {/* Top Row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 pr-2">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-manrope font-extrabold text-[17px] text-on-surface leading-tight">
                        {a.activity}
                      </h3>
                      {isActive && (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full animate-pulse"
                          style={{ backgroundColor: `${color}20`, color }}>
                          ● In Corso
                        </span>
                      )}
                      {isSubmitted && (
                        <span className="flex items-center gap-1 bg-green-50 text-green-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                          <ShieldCheck size={9}/> Inviato
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} className="text-on-surface/30 shrink-0" />
                      <span className="text-xs font-bold text-on-surface/50 truncate">{a.geofence || '—'}</span>
                    </div>
                  </div>

                  {/* Time Block */}
                  <div className="shrink-0 text-right">
                    <div className="text-[9px] font-black text-on-surface/25 uppercase tracking-widest mb-0.5">Ora</div>
                    <div className="flex items-center gap-1 text-sm font-manrope font-bold text-on-surface">
                      <span>{formatTime(a.startTime)}</span>
                      <span className="text-on-surface/20 text-xs">›</span>
                      <span className={!a.endTime ? 'text-primary' : ''}>{formatTime(a.endTime)}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Row */}
                <div className="flex items-center justify-between pt-3 border-t border-surface-low/40">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Ship size={12} className="text-on-surface/30" />
                      <span className="text-[11px] font-bold text-on-surface/50">{a.vessel}</span>
                    </div>
                    {a.weather?.wind_speed && (
                      <div className="flex items-center gap-1">
                        <Wind size={11} className="text-on-surface/25" />
                        <span className="text-[11px] font-bold text-on-surface/40">{a.weather.wind_speed}kn</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {a.msgCount > 0 && (
                      <button onClick={() => setChatModal(a)} className="relative flex items-center gap-1">
                        <MessageSquare size={15} className="text-primary/60" />
                        <span className="absolute -top-2 -right-2 w-4 h-4 bg-secondary text-white text-[8px] font-black flex items-center justify-center rounded-full">
                          {a.msgCount}
                        </span>
                      </button>
                    )}
                    {/* Press hint */}
                    <div className="flex items-center gap-1 text-on-surface/20">
                      <span className="text-[9px] font-black uppercase tracking-widest">Tieni premuto</span>
                      <ChevronRight size={10} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── BOTTOM SHEET MENU ─────────────────────────────── */}
      {menuActivity && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMenuActivity(null)}
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-[100] bg-surface-lowest rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe">
            
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-on-surface/15 rounded-full" />
            </div>

            {/* Activity Info */}
            <div className="px-6 pt-2 pb-5 border-b border-surface-low/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${activityColor(menuActivity.activity)}15` }}>
                  <Ship size={20} style={{ color: activityColor(menuActivity.activity) }} />
                </div>
                <div>
                  <h3 className="font-manrope font-extrabold text-lg text-on-surface">{menuActivity.activity}</h3>
                  <p className="text-xs font-bold text-on-surface/40">{menuActivity.vessel} · {menuActivity.geofence}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons — BIG and CLEAR */}
            <div className="px-4 py-4 space-y-3">
              
              <button
                onClick={() => { setLogbookModal(menuActivity); setMenuActivity(null); }}
                className="w-full flex items-center justify-between bg-primary/8 active:bg-primary/15 border border-primary/15 rounded-2xl px-5 py-4 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center shadow-md shadow-primary/30">
                    <Edit3 size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-manrope font-extrabold text-base text-on-surface">Modifica Logbook</p>
                    <p className="text-xs text-on-surface/40 font-semibold">Inserisci dati attività</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-on-surface/30" />
              </button>

              <button
                onClick={() => { setMenuActivity(null); /* draft save */ }}
                className="w-full flex items-center justify-between bg-surface-low/50 active:bg-surface-low border border-surface-low/50 rounded-2xl px-5 py-4 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-surface-low text-on-surface/50 flex items-center justify-center">
                    <Save size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-manrope font-extrabold text-base text-on-surface">Salva Bozza</p>
                    <p className="text-xs text-on-surface/40 font-semibold">Completa più tardi</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-on-surface/30" />
              </button>

              <button
                onClick={() => { setLogbookModal(menuActivity); setMenuActivity(null); }}
                className="w-full flex items-center justify-between bg-gradient-to-r from-primary to-secondary active:opacity-90 rounded-2xl px-5 py-4 transition-opacity shadow-lg shadow-primary/20"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-white/20 text-white flex items-center justify-center">
                    <Send size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-manrope font-extrabold text-base text-white">Sottometti</p>
                    <p className="text-xs text-white/60 font-semibold">Invia per approvazione</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-white/60" />
              </button>
            </div>

            {/* Cancel */}
            <div className="px-4 pb-8">
              <button
                onClick={() => setMenuActivity(null)}
                className="w-full py-4 rounded-2xl border-2 border-surface-low text-on-surface/40 font-black text-sm uppercase tracking-widest active:bg-surface-low transition-colors"
              >
                Annulla
              </button>
            </div>

            {menuActivity.logbookStatus === 'approved' && (
                <div className="px-4 pb-8">
                    <button
                        onClick={() => { /* handle cert SAL */ }}
                        className="w-full py-4 rounded-2xl border-2 border-primary text-primary font-black text-sm uppercase tracking-widest active:bg-primary/10 transition-colors flex items-center justify-center gap-2"
                    >
                        <ShieldCheck size={14} /> CERTIFICA SAL
                    </button>
                </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {logbookModal && (
          <LogbookEntryModal 
              activity={logbookModal} 
              profile={profile}
              entryMeta={logbookModal.logbookEntry}
              onClose={() => setLogbookModal(null)} 
              onSaved={fetchActivities}
          />
      )}
      
      {chatModal && (
        <ActivityChatModal
          activity={chatModal}
          profile={profile}
          onClose={() => { setChatModal(null); fetchActivities(); }}
        />
      )}
    </div>
  );
}
