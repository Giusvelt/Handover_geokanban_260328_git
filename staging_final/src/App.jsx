import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DataProvider, useData } from './context/DataContext';
import { supabase } from './lib/supabase';
import { useUserProfile } from './hooks/useUserProfile';
import { useSessionLock } from './hooks/useSessionLock';
import { can, ROLES } from './lib/permissions';
import Login from './components/Login';
import VesselMap from './components/VesselMap';
import VesselActivityTab from './components/VesselActivityTab';
import ProductionTargetTab from './components/ProductionTargetTab';
import DBManager from './components/DBManager';
import LogbookWriterTab from './components/LogbookWriterTab';
import StandbySchedule from './components/StandbySchedule';
import RewindMapTab from './components/RewindMapTab';
import ProfileModal from './components/ProfileModal';
import UserManagementTab from './components/UserManagementTab';
import MobileDashboard from './components/MobileDashboard';
import MobileCrewActivity from './components/MobileCrewActivity';
import MobileOperatorChat from './components/MobileOperatorChat';
import MobileCrewProfile from './components/MobileCrewProfile';
import MobileCrewNews from './components/MobileCrewNews';
import { Anchor, Activity, Target, Database, Edit3, Calendar, Rewind, Users, User, MessageSquare, Map as MapIcon, Bell } from 'lucide-react';
import logoGk from './assets/logo_gk.png';
import './index.css';

function ActivityDashboard({ onSignOut }) {
  const { vesselPositions, geofences, activities } = useData();
  const { profile, updateProfile } = useUserProfile();
  const [activeTab, setActiveTab] = useState('activity');
  const [mobileTab, setMobileTab] = useState('fleet'); // 'fleet' | 'chat' | 'activity'
  const [showProfile, setShowProfile] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    if (profile?.role === 'crew') {
      setMobileTab('activity');
    } else {
      setMobileTab('fleet');
    }
  }, [profile?.role]);

  // Resize listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Permessi basati sul ruolo (con supporto agli overrides)
  const perms = profile?.permissions || can(profile?.role);

  // Session Lock — dormiente (ENABLED=false in useSessionLock.js)
  useSessionLock(profile?.id, async (reason) => {
    alert(reason);
    await supabase.auth.signOut();
    onSignOut();
  });

  const totalMsgs = (activities || []).reduce((sum, a) => sum + (a.msgCount || 0), 0);
  const totalSubmitted = (activities || []).filter(a => a.logbookStatus === 'submitted').length;


  const renderTabContent = () => {
    return (
      <AnimatePresence mode="wait">
        <motion.div
           key={activeTab}
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           exit={{ opacity: 0, x: -20 }}
           transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {(() => {
            switch(activeTab) {
              case 'activity': return <VesselActivityTab />;
              case 'logbook-entry': return <LogbookWriterTab />;
              case 'schedule': return <StandbySchedule />;
              case 'rewind': return <RewindMapTab />;
              case 'production': return <ProductionTargetTab />;
              case 'dbmanager': return <DBManager />;
              case 'usermgmt': return <UserManagementTab />;
              default: return <VesselActivityTab />;
            }
          })()}
        </motion.div>
      </AnimatePresence>
    );
  };

  // Crew sempre mobile, operators solo se schermo piccolo
  const isCrew = profile?.role === ROLES.CREW;
  const isOperator = [ROLES.OPERATION, ROLES.OPERATION_ADMIN].includes(profile?.role);
  const showMobile = (isCrew || isOperator) && isMobile;

  if (showMobile) {
    
    return (
      <MobileDashboard 
        onSignOut={onSignOut} 
        activeTab={mobileTab} 
        setActiveTab={setMobileTab}
        navItems={isCrew ? [
          { id: 'activity', label: 'Attività', icon: Activity },
          { id: 'news', label: 'News', icon: Bell },
          { id: 'profile', label: 'Profilo', icon: User }
        ] : [
          { id: 'fleet', label: 'Mappa', icon: MapIcon },
          { id: 'chat', label: 'Messaggi', icon: MessageSquare }
        ]}
      >
        {mobileTab === 'activity' && <MobileCrewActivity />}
        {mobileTab === 'news' && <MobileCrewNews />}
        {mobileTab === 'fleet' && (
          <div className="h-[60vh] rounded-xl overflow-hidden shadow-lg border border-surface-low/50">
             <VesselMap height="100%" />
          </div>
        )}
        {mobileTab === 'chat' && <MobileOperatorChat profile={profile} />}
        {mobileTab === 'profile' && <MobileCrewProfile />}
      </MobileDashboard>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] font-manrope text-on-surface selection:bg-primary/20">
      {/* Header — Kinetic Style */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-surface-low/30 h-16 sm:h-20 lg:h-24 px-6 sm:px-10 lg:px-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="w-10 h-10 lg:w-14 lg:h-14 overflow-hidden rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 bg-white border border-surface-low/10">
            <img src={logoGk} alt="GeoKanban Logo" className="w-full h-full object-contain p-1" />
          </div>
          <div>
            <h1 className="font-manrope font-extrabold text-xl lg:text-2xl text-on-surface tracking-tight leading-none mb-1">GeoKanban V3 — SYNCED</h1>
            <p className="text-[10px] lg:text-xs font-black text-primary uppercase tracking-[0.2em] opacity-80 leading-none">Breakwater Fleet Tracker — Genova</p>
          </div>
        </div>

        <div className="flex items-center gap-4 lg:gap-8">
          {profile && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-extrabold text-on-surface leading-none mb-1">{profile.display_name}</span>
              <span className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest leading-none">{profile.role?.replace('_', ' ')}</span>
            </div>
          )}
          <button 
            onClick={() => setShowProfile(true)}
            className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-surface-low to-surface-lowest flex items-center justify-center border border-white shadow-sm active:scale-90 transition-transform hover:shadow-md transition-all"
          >
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary lg:text-lg">
              {(profile?.display_name || 'G')[0]}
            </div>
          </button>
        </div>
      </header>

      {/* Main Container — Padding for Fixed Header */}
      <main className="pt-24 sm:pt-28 lg:pt-36 px-6 sm:px-10 lg:px-16 max-w-[2100px] mx-auto pb-12">
        {/* Live Fleet Map Section — Kinetic Card */}
        <div className="mb-8 bg-white/50 backdrop-blur-md rounded-[2.5rem] p-4 border border-white shadow-sm">
          <div className="flex items-center gap-2 mb-4 px-4 py-2 bg-white/80 rounded-full w-fit border border-surface-low/30">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest leading-none">Live Fleet Tracker</span>
          </div>
          <div className="rounded-[1.5rem] overflow-hidden border border-surface-low/20">
            <VesselMap
              height="350px"
              vesselPositions={vesselPositions}
              geofences={geofences}
            />
          </div>
        </div>

        {/* Navigation Tabs — Glass Card */}
        <nav className="bg-white/50 backdrop-blur-md rounded-[2.5rem] p-2 mb-8 sm:mb-12 border border-white flex flex-wrap items-center gap-1 shadow-sm overflow-x-auto scrollbar-hide">
          {[
            { id: 'activity', label: 'Vessel Activity', icon: Activity },
            { id: 'logbook-entry', label: 'Activity Submitted', icon: Edit3, permission: perms.submitLogbook || perms.approveLogbook },
            { id: 'schedule', label: 'Schedule', icon: Calendar, permission: perms.seeSchedule },
            { id: 'rewind', label: 'Rewind', icon: Rewind, permission: perms.seeRewindMap },
            { id: 'production', label: 'Production Targets', icon: Target, permission: perms.seeProductionTargets },
            { id: 'dbmanager', label: 'DB Manager', icon: Database, permission: perms.accessDBManager },
            { id: 'usermgmt', label: 'Users', icon: Users, permission: perms.accessUserManagement },
          ].filter(item => item.permission !== false).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`
                flex items-center gap-2 lg:gap-3 px-6 lg:px-8 py-3 lg:py-4 rounded-[2rem] text-xs lg:text-sm font-extrabold tracking-tight transition-all duration-300 whitespace-nowrap
                ${activeTab === item.id 
                  ? 'bg-primary text-white shadow-lg shadow-primary/30 -translate-y-0.5' 
                  : 'text-on-surface/50 hover:text-on-surface active:bg-surface-low/50'
                }
              `}
            >
              <item.icon size={activeTab === item.id ? 18 : 16} />
              {item.label}
              {item.id === 'activity' && totalMsgs > 0 && (
                <span className="ml-1 bg-secondary text-white text-[9px] px-1.5 py-0.5 rounded-full">{totalMsgs}</span>
              )}
              {item.id === 'logbook-entry' && activeTab !== 'logbook-entry' && totalSubmitted > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full animate-pulse">{totalSubmitted}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <div className="tab-content-container">
           {renderTabContent()}
        </div>
      </main>

      {/* Profile Modal */}
      {showProfile && (
        <ProfileModal
          profile={profile}
          onClose={() => setShowProfile(false)}
          onSignOut={onSignOut}
          updateProfile={updateProfile}
        />
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const handleSession = async (session) => {
      if (!session?.user) {
        setUser(null);
        setCheckingAuth(false);
        return;
      }

      // Check MFA Assurance Level
      const { data: authLevel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const needsMFA = authLevel?.nextLevel === 'aal2' && authLevel?.currentLevel === 'aal1';

      // Fetch role to know if they MUST have AAL2
      const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single();
      const role = profile?.role || session.user.user_metadata?.role || 'crew';

      if (needsMFA && ['operation', 'operation_admin', 'crew_admin'].includes(role)) {
        // They need MFA but haven't provided it. Keep them at the login screen.
        setUser(null);
      } else {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || 'User',
          role: role
        });
      }
      setCheckingAuth(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Don't intercept SIGNED_IN directly with handleSession because Login.jsx needs to handle the MFA flow steps visually
      // Only process sign outs automatically, or if session doesn't exist
      if (!session?.user || _event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (checkingAuth) {
    return (
      <div className="loading-screen">
        <Anchor size={48} className="spin" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <DataProvider>
      <ActivityDashboard onSignOut={handleSignOut} />
    </DataProvider>
  );
}
