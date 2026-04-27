import { useEffect, useState } from 'react';
import { useStore } from './lib/store';
import { Activity, Users, Settings as SettingsIcon, Router, ChevronRight, Zap, ShieldAlert, Cpu, LogOut, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Dashboard } from './components/Dashboard';
import { Clients } from './components/Clients';
import { Login } from './components/Login';
import { UsersAdmin } from './components/UsersAdmin';
import { Routers } from './components/Routers';
import { Settings } from './components/Settings';
import { Toaster } from './components/ui/sonner';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authInitialized, setAuthInitialized] = useState(false);
  const { fetchStats, fetchClients, fetchProfiles, fetchRouters, user, token, initAuth, logout } = useStore();

  useEffect(() => {
    initAuth().then(() => setAuthInitialized(true));
  }, []);

  useEffect(() => {
    if (user && token) {
      fetchStats();
      fetchClients();
      fetchProfiles();
      fetchRouters();
      
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    }
  }, [user, token]);

  if (!authInitialized) {
      return (
          <div className="flex h-screen w-full bg-[#050505] items-center justify-center">
              <Loader2 className="w-8 h-8 text-neutral-500 animate-spin" />
          </div>
      )
  }

  if (!user || !token) {
      return (
          <>
            <Login />
            <Toaster theme="dark" />
          </>
      )
  }

  const menu = [
    { id: 'dashboard', label: 'Panel de Control', icon: Activity },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'routers', label: 'Nodos MikroTik', icon: Router },
    ...(user?.role === 'admin' ? [{ id: 'users', label: 'Administrar Usuarios', icon: ShieldAlert }] : []),
    { id: 'settings', label: 'Configuración y Bot', icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen w-full bg-[#050505] overflow-hidden text-neutral-200">
      
      {/* Sidebar */}
      <div className="w-72 glass border-r flex flex-col pt-8 pb-4 px-4 shadow-[10px_0_30px_rgba(0,0,0,0.5)] z-10 relative">
        <div className="absolute top-0 left-0 w-full h-[100px] bg-indigo-500/10 blur-3xl rounded-full"></div>
        <div className="flex items-center gap-3 px-2 mb-12 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F6D000] via-[#00247D] to-[#CF142B] flex items-center justify-center shadow-[0_0_15px_rgba(246,208,0,0.3)]">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white flex items-center gap-1">
              <span className="text-[#F6D000]">VENET</span>
              <span className="text-[#00247D]">I</span>
              <span className="text-[#CF142B]">SP</span>
            </h1>
            <p className="text-xs text-neutral-400 font-mono">v4.0 Venezuelan Edition</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 relative z-10">
          {menu.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 relative group
                ${activeTab === item.id 
                  ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)]' 
                  : 'hover:bg-white/5 text-neutral-400 hover:text-white border border-transparent'
                }`}
            >
              {activeTab === item.id && (
                <motion.div 
                  layoutId="activeTabIndicator" 
                  className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.8)]"
                />
              )}
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-indigo-400' : ''}`} />
              <span className="font-medium tracking-wide text-sm">{item.label}</span>
              <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${activeTab === item.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`} />
            </button>
          ))}
        </nav>

        <div className="mt-auto relative z-10 space-y-3">
            <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                <div>
                   <p className="text-sm font-medium text-white">{user?.username}</p>
                   <p className="text-xs text-neutral-500 font-mono capitalize">{user?.role}</p>
                </div>
                <button onClick={logout} className="p-2 hover:bg-rose-500/10 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors" title="Cerrar Sesión">
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
            {user?.role === 'admin' && (
                <div className="px-4 py-4 rounded-xl bg-red-500/5 border border-red-500/20 flex flex-col gap-2 transition-all hover:bg-red-500/10">
                    <div className="flex items-center gap-2 text-red-400">
                        <ShieldAlert className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Alerta del Sistema</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed font-mono">Motor heurístico anti-DDoS activo. Nodos seguros y estables.</p>
                </div>
            )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 relative overflow-auto">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-transparent to-transparent pointer-events-none"></div>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="p-8 h-full relative z-10"
          >
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'clients' && <Clients />}
            {activeTab === 'users' && user?.role === 'admin' && <UsersAdmin />}
            {activeTab === 'routers' && <Routers />}
            {activeTab === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>
      </main>
      <Toaster theme="dark" />
    </div>
  );
}
