import { useStore } from '../lib/store';
import { Card } from '../components/ui/card';
import { Activity, Users, Zap, Globe, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export function Dashboard() {
  const { stats, clients } = useStore();

  const data = [
    { time: '10:00', rx: 120, tx: 80 },
    { time: '10:05', rx: 180, tx: 100 },
    { time: '10:10', rx: 250, tx: 130 },
    { time: '10:15', rx: 140, tx: 90 },
    { time: '10:20', rx: 340, tx: 180 },
    { time: '10:25', rx: 300, tx: 150 },
    { time: '10:30', rx: stats?.bandwidth?.rx || 450, tx: stats?.bandwidth?.tx || 200 },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Operaciones de Red</h1>
        <p className="text-neutral-400">Monitoreo en vivo y diagnóstico de nodos</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass border-white/5 bg-white/5 p-6 relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-neutral-400 font-medium">Clientes Activos</h3>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white relative z-10">{stats?.activeClients || 0}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500 font-mono relative z-10">
            <span className="text-emerald-400">+{Math.floor(Math.random()*5)}</span> hoy
          </div>
        </Card>

        <Card className="glass border-white/5 bg-white/5 p-6 relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-neutral-400 font-medium">Tráfico Total</h3>
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
          <div className="flex items-end gap-2 relative z-10">
            <p className="text-4xl font-bold text-white">{(stats?.bandwidth?.rx || 0) + (stats?.bandwidth?.tx || 0)}</p>
            <span className="text-sm text-indigo-400 mb-1 font-mono">Mbps</span>
          </div>
        </Card>

        <Card className="glass border-white/5 bg-white/5 p-6 relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl group-hover:bg-orange-500/20 transition-all"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-neutral-400 font-medium">Nodos en Línea</h3>
            <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-orange-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white relative z-10">{stats?.routers || 0}</p>
          <div className="w-full bg-white/5 h-1.5 mt-4 rounded-full overflow-hidden relative z-10">
             <div className="bg-orange-400 h-full w-full rounded-full shadow-[0_0_10px_rgba(251,146,60,0.8)]"></div>
          </div>
        </Card>

        <Card className="glass border-white/5 bg-white/5 p-6 relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl group-hover:bg-rose-500/20 transition-all"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-neutral-400 font-medium">Cortes de Servicio</h3>
            <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white relative z-10">{(stats?.totalClients || 0) - (stats?.activeClients || 0)}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500 font-mono relative z-10">
            Requiere atención
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass border-white/5 bg-white/5 p-6 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Consumo General de Red</h3>
              <p className="text-sm text-neutral-400">Tráfico total agregado (Todos los nodos)</p>
            </div>
            <div className="flex items-center gap-4 text-sm font-mono">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
                 <span className="text-neutral-400">Descarga (Rx)</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                 <span className="text-neutral-400">Subida (Tx)</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 min-h-[300px] w-full mt-4 bg-transparent">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                   </linearGradient>
                   <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <XAxis dataKey="time" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                 <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                 <Tooltip 
                   contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', color: '#fff' }}
                   itemStyle={{ color: '#fff' }}
                 />
                 <Area type="monotone" dataKey="rx" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRx)" />
                 <Area type="monotone" dataKey="tx" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTx)" />
               </AreaChart>
             </ResponsiveContainer>
          </div>
        </Card>

        <Card className="glass border-white/5 bg-white/5 p-6 flex flex-col">
           <h3 className="text-lg font-semibold text-white mb-6">Mayor Consumo Top 5</h3>
           <div className="space-y-4 flex-1">
             {clients.slice(0, 5).map((client, i) => (
                <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center font-mono text-xs text-neutral-400">
                      0{i+1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{client.name}</p>
                      <p className="text-xs text-neutral-500 font-mono">{client.ip}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-indigo-400">
                      {Math.floor(Math.random() * 50) + 10} GB
                    </span>
                  </div>
                </div>
             ))}
             {clients.length === 0 && (
               <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-sm">
                 <Activity className="w-8 h-8 mb-2 opacity-50" />
                 Sin datos de tráfico
               </div>
             )}
           </div>
        </Card>
      </div>
    </div>
  );
}
