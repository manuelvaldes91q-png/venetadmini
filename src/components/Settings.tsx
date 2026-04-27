import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Bot, Save, BellRing, Settings2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export function Settings() {
  const { settings, fetchSettings, saveSettings, user } = useStore();
  const [token, setToken] = useState('');
  const [chatIds, setChatIds] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    setToken(settings.telegram_token || '');
    setChatIds(settings.telegram_tech_chats || '');
  }, [settings]);

  const handleSave = async () => {
    try {
      await saveSettings({
         telegram_token: token,
         telegram_tech_chats: chatIds
      });
      toast.success('¡Configuración de bot guardada! Reinicia el servidor para aplicar el bot completamente.');
    } catch(err) {
      toast.error('Error al guardar la configuración');
    }
  };

  if (user?.role !== 'admin') {
      return (
          <div className="flex items-center justify-center h-full text-neutral-400">
              <ShieldCheck className="w-12 h-12 mb-4 opacity-50" />
              <p>Acceso denegado a Configuración de Red. Contactar a un administrador.</p>
          </div>
      )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 h-full flex flex-col">
      <header className="flex items-end justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Integraciones del Sistema</h1>
          <p className="text-neutral-400">Configura bots automatizados y la API de notificaciones de Telegram</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <Card className="glass border-white/5 bg-white/5 p-6 relative overflow-hidden group">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl"></div>
            
            <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Bot className="w-5 h-5" />
                </div>
                <div>
                   <h3 className="text-xl font-semibold text-white">Telegram Bot API</h3>
                   <p className="text-sm text-neutral-400">VENETISP Assistant Module</p>
                </div>
            </div>

            <div className="space-y-4 relative z-10">
                <div className="space-y-2">
                    <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Token Bot API (De @BotFather)</label>
                    <Input 
                       value={token} 
                       onChange={e => setToken(e.target.value)} 
                       placeholder="1234567890:AAH...tu_token" 
                       className="bg-neutral-900/50 border-neutral-800 text-white focus-visible:ring-blue-500" 
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider flex items-center gap-2">
                        <BellRing className="w-3 h-3 text-neutral-500"/>
                        IDs de Chat (Separados por coma)
                    </label>
                    <Input 
                       value={chatIds} 
                       onChange={e => setChatIds(e.target.value)} 
                       placeholder="-100... , 1234567" 
                       className="bg-neutral-900/50 border-neutral-800 text-white focus-visible:ring-blue-500" 
                    />
                    <p className="text-xs text-neutral-500">Notificaciones de clientes y comandos se enviarán aquí.</p>
                </div>
                <button 
                  onClick={handleSave} 
                  className="w-full h-10 mt-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all"
                >
                    <Save className="w-4 h-4" />
                    Guardar Configuración
                </button>
            </div>
        </Card>

        {/* You could add more settings plates here like general Sync Interval, etc. */}
        <Card className="glass border-white/5 bg-white/5 p-6 opacity-50 relative pointer-events-none">
            <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                    <Settings2 className="w-5 h-5" />
                </div>
                <div>
                   <h3 className="text-xl font-semibold text-white">Intervalo de Sync Auto</h3>
                   <p className="text-sm text-neutral-400">Próximamente</p>
                </div>
            </div>
        </Card>

      </div>
    </div>
  );
}
