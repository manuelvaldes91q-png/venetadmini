import { useStore } from '../lib/store';
import { Card } from '../components/ui/card';
import { Activity, Users, Zap, Globe, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export function Dashboard() {
  const { stats, clients, routers } = useStore();

  const totalSalidaBytes = routers.reduce((acc, r) => acc + ((r.salidaTx || 0) + (r.salidaRx || 0)), 0);
  const LIMIT_2TB = 2 * 1024 * 1024 * 1024 * 1024; // 2 TB
  const percentage = (totalSalidaBytes / LIMIT_2TB) * 100;
  const isWarning = percentage >= 80;
  const isDanger = percentage >= 95;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Sort and take top 10 for chart
  const topClientsData = [...clients]
    .sort((a, b) => (b.totalBytes || 0) - (a.totalBytes || 0))
    .slice(0, 10)
    .map(c => ({
      name: c.name.length > 20 ? c.name.substring(0, 17) + '...' : c.name,
      fullName: c.name,
      total: (c.totalBytes || 0) / (1024 * 1024 * 1024), // GB
      rawTotal: c.totalBytes || 0
    }));

  const venColors = ['#F6D000', '#00247D', '#CF142B'];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Operaciones de Red <span className="text-[#F6D000]">VENET</span><span className="text-[#00247D]">I</span><span className="text-[#CF142B]">SP</span></h1>
        <p className="text-neutral-400">Monitoreo en vivo y diagnóstico de nodos</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass border-white/5 bg-white/5 p-6 relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#F6D000]/10 rounded-full blur-3xl group-hover:bg-[#F6D000]/20 transition-all"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-neutral-400 font-medium">Clientes Activos</h3>
            <div className="w-8 h-8 rounded-full bg-[#F6D000]/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#F6D000]" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white relative z-10">{stats?.activeClients || 0}</p>
        </Card>

        <Card className={`glass border-white/5 bg-white/5 p-6 relative overflow-hidden group ${isDanger ? 'border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : isWarning ? 'border-[#F6D000]/50' : ''}`}>
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#00247D]/10 rounded-full blur-3xl group-hover:bg-[#00247D]/20 transition-all"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className={`font-medium ${isDanger ? 'text-rose-400' : isWarning ? 'text-[#F6D000]' : 'text-neutral-400'}`}>Consumo SALIDA</h3>
            <div className="w-8 h-8 rounded-full bg-[#00247D]/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#00247D]" />
            </div>
          </div>
          <div className="flex items-end gap-2 relative z-10">
            <p className="text-4xl font-bold text-white">{formatBytes(totalSalidaBytes)}</p>
          </div>
          
          <div className="mt-4 relative z-10">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-neutral-500">Límite: 2 TB / Mes</span>
              <span className={`${isDanger ? 'text-rose-400 font-bold' : isWarning ? 'text-[#F6D000]' : 'text-[#00247D]'}`}>{percentage.toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${isDanger ? 'bg-rose-500' : isWarning ? 'bg-[#F6D000]' : 'bg-[#00247D]'}`} 
                style={{ width: `${Math.min(percentage, 100)}%` }}
              ></div>
            </div>
            {isWarning && (
                <p className={`text-xs mt-2 ${isDanger ? 'text-rose-400' : 'text-[#F6D000]'}`}>
                  {isDanger ? '🚨 Capacidad crítica excediendo el 95%.' : '⚠️ Advertencia: Consumo cerca del límite.'}
                </p>
            )}
          </div>
        </Card>

        <Card className="glass border-white/5 bg-white/5 p-6 relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#CF142B]/10 rounded-full blur-3xl group-hover:bg-[#CF142B]/20 transition-all"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-neutral-400 font-medium">Nodos en Línea</h3>
            <div className="w-8 h-8 rounded-full bg-[#CF142B]/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-[#CF142B]" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white relative z-10">{stats?.routers || 0}</p>
        </Card>

        <Card className="glass border-white/5 bg-white/5 p-6 relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-neutral-500/10 rounded-full blur-3xl group-hover:bg-neutral-500/20 transition-all"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-neutral-400 font-medium">Cortes Actuales</h3>
            <div className="w-8 h-8 rounded-full bg-neutral-500/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-neutral-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white relative z-10">{(stats?.totalClients || 0) - (stats?.activeClients || 0)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass border-white/5 bg-white/5 p-6 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Top 10 Consumo por Clientes</h3>
              <p className="text-sm text-neutral-400">Total acumulado de datos transferidos (GB)</p>
            </div>
            <BarChart3 className="w-5 h-5 text-indigo-400 opacity-50" />
          </div>
          
          <div className="flex-1 min-h-[350px] w-full mt-4 bg-transparent">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={topClientsData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                 <XAxis 
                   dataKey="name" 
                   stroke="#525252" 
                   fontSize={11} 
                   tickLine={false} 
                   axisLine={false}
                   angle={-15}
                   textAnchor="end"
                 />
                 <YAxis stroke="#525252" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}G`} />
                 <Tooltip 
                   cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                   contentStyle={{ backgroundColor: '#171717', borderColor: '#333', borderRadius: '12px', fontSize: '12px' }}
                   formatter={(value: number) => [`${value.toFixed(2)} GB`, 'Consumo']}
                   labelFormatter={(label, payload) => {
                     const full = payload?.[0]?.payload?.fullName || label;
                     return <span className="text-indigo-400 font-bold">{full}</span>;
                   }}
                 />
                 <Bar dataKey="total" radius={[4, 4, 0, 0]} barSize={35}>
                   {topClientsData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={venColors[index % 3]} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
          </div>
        </Card>

        <Card className="glass border-white/5 bg-white/5 p-6 flex flex-col">
           <h3 className="text-lg font-semibold text-white mb-6">Ranking de Consumo</h3>
           <div className="space-y-3 flex-1 overflow-auto max-h-[400px] pr-2 scrollbar-hide">
             {[...clients]
              .sort((a, b) => (b.totalBytes || 0) - (a.totalBytes || 0))
              .slice(0, 10).map((client, i) => (
                <div key={client.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-white/5 flex items-center justify-center font-mono text-[10px] text-neutral-500 group-hover:border-indigo-500/30 transition-colors">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white truncate w-[180px] sm:w-[220px]" title={client.name}>{client.name}</p>
                      <p className="text-[10px] text-neutral-500 font-mono italic">{client.ip}</p>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap pl-2">
                    <div className="text-sm font-bold text-[#F6D000]">
                      {formatBytes(client.totalBytes || 0)}
                    </div>
                    <div className="text-[9px] text-neutral-500 uppercase font-mono mt-0.5">Acumulado</div>
                  </div>
                </div>
              ))}
             {clients.length === 0 && (
               <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-sm py-12">
                 <Activity className="w-8 h-8 mb-2 opacity-50 text-[#CF142B]" />
                 Sin datos de tráfico detectados
               </div>
             )}
           </div>
        </Card>
      </div>
    </div>
  );
}
