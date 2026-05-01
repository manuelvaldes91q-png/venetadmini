import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Search, Plus, Wifi, WifiOff, Power, PowerOff, ShieldCheck, Users, SignalHigh, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';

export function Clients() {
  const { clients, leases, fetchLeases, routers, profiles, addClient, toggleClient, deleteClient, updateClientProfile, user } = useStore();
  const [search, setSearch] = useState('');
  
  const [showProvision, setShowProvision] = useState(false);
  const [selectedLease, setSelectedLease] = useState<any>(null);
  
  const [provName, setProvName] = useState('');
  const [provRouter, setProvRouter] = useState('');
  const [provProfile, setProvProfile] = useState('');

  useEffect(() => {
    fetchLeases();
  }, []);

  const filtered = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.ip.includes(search)
  );

  const handleToggle = async (id: string, currentDisabled: number) => {
    try {
      await toggleClient(id);
      toast.success(currentDisabled ? 'Servicio reactivado exitosamente' : 'Servicio cortado exitosamente', {
        description: 'Se actualizaron las entradas ARP en el nodo MikroTik.',
      });
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar estado del servicio');
    }
  };

  const handleProvision = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!selectedLease || !provName || !provRouter || !provProfile) return;
     
     try {
       await addClient({
          name: provName,
          ip: selectedLease.ip,
          mac: selectedLease.mac,
          routerId: provRouter,
          profileId: provProfile
       });
       toast.success('Cliente aprovisionado correctamente.');
       setShowProvision(false);
       setSelectedLease(null);
       setProvName('');
       fetchLeases(); // Refresh leases (ideally it would remove it)
     } catch (err: any) {
       toast.error(err.message || 'Error al aprovisionar el cliente');
     }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 h-full flex flex-col">
      <header className="flex items-end justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Aprovisionamiento de Clientes</h1>
          <p className="text-neutral-400">Gestiona leases DHCP, IPs estáticas y colas de control de ancho de banda</p>
        </div>
        <button 
          onClick={() => setShowProvision(!showProvision)}
          className={`h-10 px-4 transition-colors text-white rounded-lg font-medium flex items-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.4)] ${showProvision ? 'bg-neutral-800 shadow-none' : 'bg-indigo-600 hover:bg-indigo-500'}`}
        >
          <Plus className={`w-4 h-4 transition-transform ${showProvision ? 'rotate-45' : ''}`} />
          <span>{showProvision ? 'Cerrar Panel' : 'Aprovisionar desde DHCP'}</span>
        </button>
      </header>

      {showProvision && (
         <Card className="glass border-white/5 bg-indigo-500/5 p-6 mb-4 animate-in slide-in-from-top-4 fade-in duration-300">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
               <SignalHigh className="w-5 h-5 text-indigo-400" />
               Leases DHCP (IPs Dinámicas sin Asignar)
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="h-64 overflow-auto bg-neutral-950 border border-white/10 rounded-xl">
                 <table className="w-full text-left text-sm text-neutral-300">
                    <thead className="text-xs uppercase bg-neutral-900 sticky top-0">
                      <tr>
                         <th className="px-4 py-3">IP / MAC</th>
                         <th className="px-4 py-3">Nombre Host</th>
                         <th className="px-4 py-3">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leases.map((ls) => (
                         <tr key={ls.id} className={`border-b border-white/5 transition-colors ${selectedLease?.id === ls.id ? 'bg-indigo-500/10' : 'hover:bg-white/5'}`}>
                           <td className="px-4 py-2 font-mono">
                              <div className="text-indigo-400 font-bold">{ls.ip}</div>
                              <div className="text-xs text-neutral-500">{ls.mac}</div>
                           </td>
                           <td className="px-4 py-2">{ls.hostname}</td>
                           <td className="px-4 py-2">
                              <button 
                                onClick={() => {
                                  setSelectedLease(ls);
                                  setProvName(ls.hostname);
                                }}
                                className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors"
                              >
                                Seleccionar
                              </button>
                           </td>
                         </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
               
               {selectedLease ? (
                  <div className="p-4 bg-neutral-900 border border-indigo-500/30 rounded-xl neon-border-blue relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                     <h4 className="font-semibold text-white mb-4">Aprovisionando: <span className="font-mono text-indigo-300">{selectedLease.ip}</span></h4>
                     <form onSubmit={handleProvision} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Nombre del Cliente</label>
                            <Input value={provName} onChange={e => setProvName(e.target.value)} required className="bg-neutral-950 border-neutral-800 text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                               <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Nodo MikroTik</label>
                               <select required value={provRouter} onChange={e => setProvRouter(e.target.value)} className="w-full flex h-10 items-center justify-between rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500">
                                  <option value="">-- Seleccionar --</option>
                                  {routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                               </select>
                           </div>
                           <div className="space-y-2">
                               <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Plan de Velocidad</label>
                               <select required value={provProfile} onChange={e => setProvProfile(e.target.value)} className="w-full flex h-10 items-center justify-between rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500">
                                  <option value="">-- Seleccionar --</option>
                                  {profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.rxLimit}/{p.txLimit})</option>)}
                               </select>
                           </div>
                        </div>
                        <button type="submit" className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all">
                           Convertir a IP Fija y Crear Cola
                        </button>
                     </form>
                  </div>
               ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center border overflow-hidden border-dashed border-white/10 rounded-xl bg-neutral-950/50">
                    <SignalHigh className="w-10 h-10 text-neutral-600 mb-2" />
                    <p className="text-neutral-500 text-sm">Selecciona una conexión (lease) de la tabla para iniciar el aprovisionamiento automatizado.</p>
                  </div>
               )}
            </div>
         </Card>
      )}

      <Card className="glass border-white/5 bg-white/5 p-4 flex-1 flex flex-col min-h-0 relative z-10 transition-all">

        <div className="flex gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <Input 
              className="bg-neutral-900/50 border-neutral-800 text-white pl-10 h-10 w-full focus-visible:ring-indigo-500" 
              placeholder="Buscar por nombre, IP o MAC..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 ml-auto text-sm text-neutral-400">
            <Badge variant="outline" className="bg-neutral-900 border-neutral-800">{clients.length} Total</Badge>
            <Badge variant="outline" className="bg-emerald-950/30 text-emerald-400 border-emerald-900/50">{clients.filter(c => !c.disabled).length} Activos</Badge>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-neutral-900/20 rounded-xl border border-white/5">
          <table className="w-full text-left text-sm text-neutral-300">
            <thead className="text-xs uppercase bg-neutral-950/80 text-neutral-500 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-4 py-4 font-medium pl-6">Información de Cliente</th>
                <th className="px-4 py-4 font-medium">IP / DHCP</th>
                <th className="px-4 py-4 font-medium">Consumo Total</th>
                <th className="px-4 py-4 font-medium">Perfil / Plan</th>
                <th className="px-4 py-4 font-medium">Estado</th>
                <th className="px-4 py-4 font-medium text-right pr-6">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => {
                const formatBytes = (bytes: number) => {
                    if (bytes === 0) return '0 B';
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                };

                return (
                <tr key={client.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-3 pl-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${client.disabled ? 'bg-rose-950/30 border-rose-900/50 text-rose-500' : 'bg-indigo-950/30 border-indigo-900/50 text-[#F6D000]'}`}>
                        {client.disabled ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{client.name}</div>
                        <div className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                           <ShieldCheck className="w-3 h-3 text-emerald-500" />
                           IP Fija
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <div className="flex items-center gap-2">
                       <span className="text-indigo-300 font-bold">{client.ip}</span>
                       {(() => {
                           const octet = parseInt(client.ip.split('.')[3] || '0', 10);
                           let provider = '';
                           let provColor = '';
                           if (octet >= 3 && octet <= 130) {
                               provider = 'Inter';
                               provColor = 'text-blue-400 bg-blue-900/20 border-blue-900/50';
                           } else if (octet >= 131 && octet <= 250) {
                               provider = 'Airtek';
                               provColor = 'text-purple-400 bg-purple-900/20 border-purple-900/50';
                           }
                           
                           return provider ? (
                               <Badge variant="outline" className={`text-[9px] uppercase px-1.5 py-0 border ${provColor}`}>
                                  {provider}
                               </Badge>
                           ) : null;
                       })()}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">{client.mac}</div>
                  </td>
                  <td className="px-4 py-3">
                     <div className="flex flex-col">
                        <span className="text-sm font-bold text-white tracking-tight">{formatBytes(client.totalBytes || 0)}</span>
                        <span className="text-[10px] text-neutral-500 uppercase flex items-center gap-1">
                           <ArrowUpRight className="w-2 h-2 text-rose-500" /> {formatBytes(client.txBytes || 0)}
                           <ArrowDownRight className="w-2 h-2 text-emerald-500" /> {formatBytes(client.rxBytes || 0)}
                        </span>
                     </div>
                  </td>
                  <td className="px-4 py-3">
                    <select 
                       value={client.profileId || ''} 
                       onChange={async (e) => {
                          try {
                             await updateClientProfile(client.id, e.target.value);
                             toast.success('Perfil actualizado');
                          } catch(err) {
                             toast.error('Error al actualizar');
                          }
                       }}
                       className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded-md px-2 py-1 focus:ring-1 focus:ring-indigo-500 w-full max-w-[150px]"
                    >
                       <option value="">Por Defecto</option>
                       {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {client.disabled ? (
                       <Badge variant="outline" className="bg-rose-950/30 text-rose-400 border-rose-900/50">Servicio Cortado</Badge>
                    ) : (
                       <Badge variant="outline" className="bg-emerald-950/30 text-emerald-400 border-emerald-900/50">Activo</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right pr-6">
                    <div className="flex items-center justify-end gap-3 transition-opacity">
                      
                      <button 
                         onClick={() => handleToggle(client.id, client.disabled)}
                         className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 transition-colors ${
                          client.disabled 
                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                        }`}
                      >
                         {client.disabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                         {client.disabled ? 'Activar' : 'Cortar'}
                      </button>
                      
                      {user?.role !== 'readonly' && (
                        <button 
                          onClick={async () => {
                             if(confirm(`¿Eliminar al cliente ${client.name}?`)) {
                                try {
                                   await deleteClient(client.id);
                                   toast.success('Cliente eliminado');
                                } catch(err) { toast.error('Error al eliminar'); }
                             }
                          }}
                          className="w-8 h-8 rounded flex items-center justify-center hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="Eliminar Cliente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No se encontraron clientes.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
