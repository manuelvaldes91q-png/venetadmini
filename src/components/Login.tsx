import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import React, { useState } from 'react';
import { Zap, Lock, User } from 'lucide-react';
import { useStore } from '../lib/store';
import { toast } from 'sonner';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        login(data.token, data.user);
        toast.success(`Bienvenido, ${data.user.username}`);
      } else {
        toast.error(data.error || 'Credenciales inválidas');
      }
    } catch (err) {
      toast.error('Error de red. Revisa la conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#050505] relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      
      <Card className="glass border-white/10 w-full max-w-md p-8 relative z-10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center neon-border-blue mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white neon-text-blue">NexusISP</h1>
          <p className="text-neutral-400 text-sm font-mono mt-1">Puerta de Identidad</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <Input 
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Usuario (ej., admin)" 
                className="bg-neutral-900/50 border-neutral-800 text-white pl-10 h-12 focus-visible:ring-indigo-500" 
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <Input 
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password" 
                placeholder="Contraseña (ej., admin123)" 
                className="bg-neutral-900/50 border-neutral-800 text-white pl-10 h-12 focus-visible:ring-indigo-500" 
                required
              />
            </div>
          </div>

          <Button 
            disabled={loading}
            type="submit" 
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-lg mt-4 shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all"
          >
            {loading ? 'Autenticando...' : 'Iniciar Sesión'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
