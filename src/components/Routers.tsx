import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Server, Plus, Route, ShieldAlert, Trash2, Activity, X } from 'lucide-react';
import { toast } from 'sonner';

function MonitorModal({ routerId, onClose }: { routerId: string, onClose: () => void }) {
  const { fetchAuthAndData } = useStore();
  const [data, setData] = useState<{netwatch: any[], routes: any[]} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuthAndData(`/api/routers/${routerId}/monitor`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
         toast.error("Error al cargar monitor");
         setLoading(false);
      });
  }, [routerId]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-neutral-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
             <Activity className="w-5 h-5 text-indigo-400" />
             Monitor de Líneas y Antenas
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-neutral-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
             <div className="text-center text-neutral-400 py-10">Cargando datos del router...</div>
          ) : (
            <>
              <div>
                 <h3 className="text-sm uppercase font-bold text-neutral-400 mb-3 tracking-wider">Antenas (Netwatch)</h3>
                 {data?.netwatch?.length === 0 ? (
                    <div className="text-neutral-500 text-sm">No hay registros en Netwatch.</div>
                 ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                       {data?.netwatch?.map((n: any) => (
                           <div key={n['.id']} className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between">
                              <div>
                                <div className="text-white font-medium text-sm">{n.host}</div>
                                <div className="text-xs text-neutral-400">{n.comment || 'Sin nombre'}</div>
                              </div>
                              <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${n.status === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {n.status}
                              </div>
                           </div>
                       ))}
                    </div>
                 )}
              </div>

              <div>
                 <h3 className="text-sm uppercase font-bold text-neutral-400 mb-3 tracking-wider">Rutas Activas (WAN1 / WAN2)</h3>
                 <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                   <table className="w-full text-left text-sm">
                     <thead className="bg-white/5 border-b border-white/10 text-neutral-400">
                       <tr>
                         <th className="p-3 font-medium">Destino</th>
                         <th className="p-3 font-medium">Gateway</th>
                         <th className="p-3 font-medium">Distancia</th>
                         <th className="p-3 font-medium">Status</th>
                         <th className="p-3 font-medium">Comentario</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5 text-neutral-300">
                       {data?.routes?.filter((r: any) => r.comment && (r.comment.toUpperCase().includes('WAN') || r.comment.toUpperCase().includes('AIRTEK') || r.comment.toUpperCase().includes('INTER'))).map((r: any) => (
                          <tr key={r['.id']}>
                            <td className="p-3 font-mono">{r['dst-address']}</td>
                            <td className="p-3">{r.gateway}</td>
                            <td className="p-3">{r.distance}</td>
                            <td className="p-3">
                               {r.active === 'true' ? (
                                  <span className="text-emerald-400 font-medium">Activa</span>
                               ) : (
                                  <span className="text-neutral-500">Inactiva</span>
                               )}
                            </td>
                            <td className="p-3 text-neutral-400 text-xs">{r.comment}</td>
                          </tr>
                       ))}
                       {data?.routes?.filter((r: any) => r.comment && (r.comment.toUpperCase().includes('WAN') || r.comment.toUpperCase().includes('AIRTEK') || r.comment.toUpperCase().includes('INTER'))).length === 0 && (
                          <tr><td colSpan={5} className="p-4 text-center text-neutral-500">No se encontraron rutas etiquetadas como WAN, AIRTEK o INTER</td></tr>
                       )}
                     </tbody>
                   </table>
                 </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function Routers() {
  const { routers, fetchRouters, addRouter, deleteRouter, user } = useStore();
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8728');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [monitorRouterId, setMonitorRouterId] = useState<string | null>(null);

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
                           <div className="flex flex-col gap-2">
                             <button onClick={() => setMonitorRouterId(rt.id)} className="text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 flex items-center gap-1 rounded text-xs transition-colors w-full justify-center">
                               <Activity className="w-3 h-3" />
                               Monitorear
                             </button>
                             <button onClick={() => {
                                 if (confirm(`¿Eliminar router ${rt.name}?`)) {
                                     deleteRouter(rt.id).then(()=>toast.success('Router eliminado')).catch(()=>toast.error('Ocurrió un error'));
                                 }
                             }} className="text-rose-400 hover:text-rose-300 bg-rose-500/10 px-2 py-1 flex items-center gap-1 rounded text-xs transition-colors w-full justify-center">
                               <Trash2 className="w-3 h-3" />
                               Quitar Nodo
                             </button>
                           </div>
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
      {monitorRouterId && <MonitorModal routerId={monitorRouterId} onClose={() => setMonitorRouterId(null)} />}
    </div>
  );
}
