import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Trash2, UserPlus, Shield, UserCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';

export function UsersAdmin() {
  const { users, fetchUsers, deleteUser, fetchAuthAndData, user: currentUser } = useStore();
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('tech');

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchAuthAndData('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole })
      });
      if (res.ok) {
        toast.success(`Usuario ${newUsername} creado.`);
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
      } else {
        toast.error((await res.json()).error || 'Fallo de creacion');
      }
    } catch(err) {
      toast.error('Error de conexion.');
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`¿Seguro que quieres eliminar a ${username}?`)) return;
    try {
        await deleteUser(id);
        toast.success(`Usuario eliminado`);
    } catch(err) {
        toast.error('Error al eliminar');
    }
  }

  // Only admin can view this page ideally, check role
  if (currentUser?.role !== 'admin') {
      return (
          <div className="flex items-center justify-center h-full text-neutral-400">
              <Shield className="w-12 h-12 mb-4 opacity-50" />
              <p>Acceso denegado. Se requiere administrador.</p>
          </div>
      )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 h-full flex flex-col">
      <header className="flex items-end justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Administrar Accesos</h1>
          <p className="text-neutral-400">Gestiona usuarios técnicos con acceso al panel.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* User Formulation */}
        <Card className="glass border-white/5 bg-white/5 p-6 h-fit">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                Invitar / Crear Usuario
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Nombre de Usuario</label>
                    <Input 
                        value={newUsername} onChange={e => setNewUsername(e.target.value)} required
                        className="bg-neutral-900/50 border-neutral-800 text-white h-10 focus-visible:ring-indigo-500" 
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Contraseña</label>
                    <Input 
                        type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required
                        className="bg-neutral-900/50 border-neutral-800 text-white h-10 focus-visible:ring-indigo-500" 
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Rol de Acceso</label>
                    <select 
                        value={newRole} onChange={e => setNewRole(e.target.value)}
                        className="w-full flex h-10 items-center justify-between rounded-md border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option value="admin">Administrador (Control Total)</option>
                        <option value="tech">Técnico (Puede Puntear y Cortar)</option>
                        <option value="readonly">Solo Lectura (Ver)</option>
                    </select>
                </div>
                <button type="submit" className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-colors mt-4">
                    Crear Credenciales
                </button>
            </form>
        </Card>

        {/* User Table */}
        <Card className="glass border-white/5 bg-white/5 p-4 lg:col-span-2 flex flex-col min-h-[400px]">
            <div className="flex-1 overflow-auto bg-neutral-900/20 rounded-xl border border-white/5">
                <table className="w-full text-left text-sm text-neutral-300">
                    <thead className="text-xs uppercase bg-neutral-950/80 text-neutral-500 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                        <th className="px-4 py-4 font-medium pl-6">Usuario</th>
                        <th className="px-4 py-4 font-medium">Rol</th>
                        <th className="px-4 py-4 font-medium text-right pr-6">Acciones</th>
                    </tr>
                    </thead>
                    <tbody>
                    {users.map((u) => (
                        <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                           <td className="px-4 py-3 pl-6">
                               <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-indigo-950/30 border border-indigo-900/50 flex items-center justify-center text-indigo-400">
                                       <UserCircle className="w-4 h-4" />
                                   </div>
                                   <span className="font-semibold text-white">{u.username}</span>
                               </div>
                           </td>
                           <td className="px-4 py-3">
                               {u.role === 'admin' && <Badge variant="outline" className="bg-rose-950/30 text-rose-400 border-rose-900/50"><Shield className="w-3 h-3 mr-1"/> Admin</Badge>}
                               {u.role === 'tech' && <Badge variant="outline" className="bg-indigo-950/30 text-indigo-400 border-indigo-900/50">Técnico</Badge>}
                               {u.role === 'readonly' && <Badge variant="outline" className="bg-neutral-800 text-neutral-400 border-neutral-700"><Eye className="w-3 h-3 mr-1"/> Solo Lectura</Badge>}
                           </td>
                           <td className="px-4 py-3 text-right pr-6">
                               {currentUser?.id !== u.id && (
                                   <button onClick={() => handleDelete(u.id, u.username)} className="p-2 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100">
                                       <Trash2 className="w-4 h-4" />
                                   </button>
                               )}
                           </td>
                        </tr>
                    ))}
                    {users.length === 0 && (
                        <tr>
                            <td colSpan={3} className="py-8 text-center text-neutral-500 font-mono text-xs">No hay usuarios.</td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </Card>
      </div>
    </div>
  );
}
