import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Server, Plus, Route, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function Routers() {
  const { routers, fetchRouters, addRouter, deleteRouter, user } = useStore();
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8728');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  useEffect(() => {
    fetchRouters();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addRouter({ name, host, port: parseInt(port) || 8728, username, password });
      toast.success('MikroTik added to cluster.');
      setName(''); setHost(''); setPassword('');
    } catch(err: any) {
      toast.error(err.message || 'Failed to add Router');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 h-full flex flex-col">
      <header className="flex items-end justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Clúster MikroTik</h1>
          <p className="text-neutral-400">Gestiona múltiples pasarelas MikroTik a través de la API</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {user?.role === 'admin' && (
          <Card className="glass border-white/5 bg-white/5 p-6 h-fit">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                Añadir Nodo MikroTik
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Nombre del Router</label>
                    <Input value={name} onChange={e => setName(e.target.value)} required placeholder="ej. Nodo Central Fibra" className="bg-neutral-900/50 border-neutral-800 text-white" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                      <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Host / IP API</label>
                      <Input value={host} onChange={e => setHost(e.target.value)} required placeholder="192.168.88.1" className="bg-neutral-900/50 border-neutral-800 text-white" />
                  </div>
                  <div className="space-y-2">
                      <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Puerto</label>
                      <Input value={port} onChange={e => setPort(e.target.value)} required placeholder="8728" className="bg-neutral-900/50 border-neutral-800 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Usuario API</label>
                    <Input value={username} onChange={e => setUsername(e.target.value)} required className="bg-neutral-900/50 border-neutral-800 text-white" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Contraseña API</label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="bg-neutral-900/50 border-neutral-800 text-white" />
                </div>
                <button type="submit" className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-colors mt-4">
                    Conectar Router
                </button>
            </form>
          </Card>
        )}

        <div className="lg:col-span-2 space-y-4">
            {routers.map((rt) => (
               <Card key={rt.id} className="glass border-white/5 bg-white/5 p-5 relative overflow-hidden group">
                  <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl"></div>
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center neon-border-blue">
                         <Server className="w-6 h-6 text-indigo-400" />
                       </div>
                       <div>
                         <h3 className="text-lg font-bold text-white">{rt.name}</h3>
                         <div className="flex items-center gap-2 mt-1">
                           <Route className="w-4 h-4 text-neutral-500" />
                           <span className="text-sm text-neutral-400 font-mono">{rt.host}:{rt.port}</span>
                           <span className="text-sm text-neutral-500 ml-2">({rt.username})</span>
                         </div>
                       </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                           <span className={`w-2 h-2 rounded-full ${rt.status === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}></span>
                           <span className="text-sm font-medium uppercase tracking-wider text-neutral-300">
                             {rt.status}
                           </span>
                        </div>
                        {user?.role === 'admin' && (
                           <button onClick={() => {
                               if (confirm(`¿Eliminar router ${rt.name}?`)) {
                                   deleteRouter(rt.id).then(()=>toast.success('Router eliminado')).catch(()=>toast.error('Ocurrió un error'));
                               }
                           }} className="text-rose-400 hover:text-rose-300 bg-rose-500/10 px-2 py-1 flex items-center gap-1 rounded text-xs transition-colors">
                             <Trash2 className="w-3 h-3" />
                             Quitar Nodo
                           </button>
                        )}
                    </div>
                  </div>
               </Card>
            ))}

            {routers.length === 0 && (
               <div className="flex flex-col items-center justify-center p-12 text-center border overflow-hidden border-dashed border-white/10 rounded-xl bg-white/5">
                 <ShieldAlert className="w-12 h-12 text-neutral-600 mb-4" />
                 <p className="text-neutral-400">No hay routers configurados.</p>
               </div>
            )}
        </div>
      </div>
    </div>
  );
}
