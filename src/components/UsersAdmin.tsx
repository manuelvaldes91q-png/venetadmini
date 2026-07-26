import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Trash2, UserPlus, Shield, UserCircle, Eye, KeyRound, ShieldAlert, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function UsersAdmin() {
  const { users, fetchUsers, deleteUser, fetchAuthAndData, changeMyPassword, changeUserPassword, user: currentUser } = useStore();
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('tech');

  // Change Own Password State
  const [currentMyPassword, setCurrentMyPassword] = useState('');
  const [newMyPassword, setNewMyPassword] = useState('');
  const [confirmMyPassword, setConfirmMyPassword] = useState('');
  const [myPassLoading, setMyPassLoading] = useState(false);

  // User Reset Password Modal State
  const [resetModalUser, setResetModalUser] = useState<any | null>(null);
  const [userNewPassword, setUserNewPassword] = useState('');
  const [userPassLoading, setUserPassLoading] = useState(false);

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
        toast.error((await res.json()).error || 'Fallo de creación');
      }
    } catch(err) {
      toast.error('Error de conexión.');
    }
  };

  const handleChangeMyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMyPassword !== confirmMyPassword) {
      toast.error('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (newMyPassword.length < 4) {
      toast.error('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    setMyPassLoading(true);
    try {
      await changeMyPassword(currentMyPassword, newMyPassword);
      toast.success('¡Contraseña actualizada correctamente!');
      setCurrentMyPassword('');
      setNewMyPassword('');
      setConfirmMyPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar la contraseña.');
    } finally {
      setMyPassLoading(false);
    }
  };

  const handleResetUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    if (userNewPassword.length < 4) {
      toast.error('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    setUserPassLoading(true);
    try {
      const targetId = resetModalUser.id || resetModalUser.username;
      await changeUserPassword(targetId, userNewPassword);
      toast.success(`Contraseña de ${resetModalUser.username} actualizada.`);
      setResetModalUser(null);
      setUserNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar la contraseña del usuario.');
    } finally {
      setUserPassLoading(false);
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
  };

  // Only admin can view this page ideally, check role
  if (currentUser?.role !== 'admin') {
      return (
          <div className="flex flex-col items-center justify-center h-full text-neutral-400">
              <Shield className="w-12 h-12 mb-4 opacity-50 text-rose-500" />
              <p>Acceso denegado. Se requiere rol de administrador.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 h-full flex flex-col">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-indigo-400" />
            Seguridad y Control de Accesos
          </h1>
          <p className="text-neutral-400">Gestiona credenciales, cambio de contraseñas y políticas de protección del servidor.</p>
        </div>
      </header>

      {/* Default Password Warning Banner */}
      {currentUser?.isDefaultPassword && (
        <Card className="bg-amber-950/40 border-amber-500/30 p-4 flex items-center gap-4 text-amber-200 shadow-lg">
          <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-amber-300">¡Atención! Estás utilizando la contraseña por defecto ('admin123')</h4>
            <p className="text-xs text-amber-300/80 mt-0.5">Por motivos de seguridad, cambia inmediatamente la contraseña del administrador para evitar accesos no autorizados.</p>
          </div>
        </Card>
      )}

      {/* Security Protection Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass border-emerald-500/20 bg-emerald-950/10 p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-neutral-400 font-medium">Encriptación de Claves</div>
            <div className="text-sm font-semibold text-white flex items-center gap-1.5">
              PBKDF2 + Salt <CheckCircle className="w-3.5 h-3.5 text-emerald-400 inline" />
            </div>
          </div>
        </Card>

        <Card className="glass border-indigo-500/20 bg-indigo-950/10 p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-neutral-400 font-medium">Protección Brute-Force</div>
            <div className="text-sm font-semibold text-white flex items-center gap-1.5">
              Rate Limiter Activo <CheckCircle className="w-3.5 h-3.5 text-emerald-400 inline" />
            </div>
          </div>
        </Card>

        <Card className="glass border-purple-500/20 bg-purple-950/10 p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/20 text-purple-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-neutral-400 font-medium">Protección Anti-Ataques Web</div>
            <div className="text-sm font-semibold text-white flex items-center gap-1.5">
              Security Headers <CheckCircle className="w-3.5 h-3.5 text-emerald-400 inline" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Forms column */}
        <div className="space-y-6">
          
          {/* Change My Password Form */}
          <Card className="glass border-white/5 bg-white/5 p-6 h-fit">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  Cambiar Mi Contraseña ({currentUser?.username})
              </h3>
              <form onSubmit={handleChangeMyPassword} className="space-y-3">
                  <div className="space-y-1">
                      <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Contraseña Actual</label>
                      <Input 
                          type="password"
                          value={currentMyPassword} 
                          onChange={e => setCurrentMyPassword(e.target.value)} 
                          required
                          placeholder="Tu contraseña actual"
                          className="bg-neutral-900/50 border-neutral-800 text-white h-10 focus-visible:ring-amber-500" 
                      />
                  </div>
                  <div className="space-y-1">
                      <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Nueva Contraseña</label>
                      <Input 
                          type="password"
                          value={newMyPassword} 
                          onChange={e => setNewMyPassword(e.target.value)} 
                          required
                          placeholder="Mínimo 4 caracteres"
                          className="bg-neutral-900/50 border-neutral-800 text-white h-10 focus-visible:ring-amber-500" 
                      />
                  </div>
                  <div className="space-y-1">
                      <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Confirmar Nueva Contraseña</label>
                      <Input 
                          type="password"
                          value={confirmMyPassword} 
                          onChange={e => setConfirmMyPassword(e.target.value)} 
                          required
                          placeholder="Repite la nueva contraseña"
                          className="bg-neutral-900/50 border-neutral-800 text-white h-10 focus-visible:ring-amber-500" 
                      />
                  </div>
                  <button 
                      type="submit" 
                      disabled={myPassLoading}
                      className="w-full h-10 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg font-medium shadow-[0_0_15px_rgba(217,119,6,0.3)] transition-colors mt-3 flex items-center justify-center gap-2"
                  >
                      {myPassLoading ? 'Actualizando...' : 'Actualizar Mi Contraseña'}
                  </button>
              </form>
          </Card>

          {/* User Creation Form */}
          <Card className="glass border-white/5 bg-white/5 p-6 h-fit">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-400" />
                  Crear Nuevo Usuario
              </h3>
              <form onSubmit={handleCreate} className="space-y-3">
                  <div className="space-y-1">
                      <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Nombre de Usuario</label>
                      <Input 
                          value={newUsername} onChange={e => setNewUsername(e.target.value)} required
                          placeholder="ej. tecnico_soporte"
                          className="bg-neutral-900/50 border-neutral-800 text-white h-10 focus-visible:ring-indigo-500" 
                      />
                  </div>
                  <div className="space-y-1">
                      <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Contraseña Inicial</label>
                      <Input 
                          type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required
                          placeholder="Mínimo 4 caracteres"
                          className="bg-neutral-900/50 border-neutral-800 text-white h-10 focus-visible:ring-indigo-500" 
                      />
                  </div>
                  <div className="space-y-1">
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
                  <button type="submit" className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-colors mt-3">
                      Crear Credenciales
                  </button>
              </form>
          </Card>
        </div>

        {/* User Table */}
        <Card className="glass border-white/5 bg-white/5 p-4 lg:col-span-2 flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <UserCircle className="w-5 h-5 text-indigo-400" />
                Usuarios Registrados
              </h3>
              <span className="text-xs text-neutral-400 font-mono">{users.length} Usuario(s)</span>
            </div>

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
                                   <div>
                                     <span className="font-semibold text-white block">{u.username}</span>
                                     {u.id === currentUser?.id && (
                                       <span className="text-[10px] text-emerald-400 font-mono">(Tú)</span>
                                     )}
                                   </div>
                               </div>
                           </td>
                           <td className="px-4 py-3">
                               {u.role === 'admin' && <Badge variant="outline" className="bg-rose-950/30 text-rose-400 border-rose-900/50"><Shield className="w-3 h-3 mr-1"/> Admin</Badge>}
                               {u.role === 'tech' && <Badge variant="outline" className="bg-indigo-950/30 text-indigo-400 border-indigo-900/50">Técnico</Badge>}
                               {u.role === 'readonly' && <Badge variant="outline" className="bg-neutral-800 text-neutral-400 border-neutral-700"><Eye className="w-3 h-3 mr-1"/> Solo Lectura</Badge>}
                           </td>
                           <td className="px-4 py-3 text-right pr-6 space-x-1">
                               <button 
                                   onClick={() => setResetModalUser(u)} 
                                   title="Cambiar contraseña de usuario"
                                   className="p-2 text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors inline-flex items-center gap-1 text-xs font-medium"
                               >
                                   <KeyRound className="w-3.5 h-3.5" />
                                   Clave
                               </button>

                               {currentUser?.id !== u.id && (
                                   <button 
                                       onClick={() => handleDelete(u.id, u.username)} 
                                       title="Eliminar usuario"
                                       className="p-2 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors inline-block"
                                   >
                                       <Trash2 className="w-4 h-4" />
                                   </button>
                               )}
                           </td>
                        </tr>
                    ))}
                    {users.length === 0 && (
                        <tr>
                            <td colSpan={3} className="py-8 text-center text-neutral-500 font-mono text-xs">No hay usuarios registrados.</td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </Card>
      </div>

      {/* Admin Reset Password Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Card className="glass border-white/10 bg-neutral-900 w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                Cambiar Clave de {resetModalUser.username}
              </h3>
              <button onClick={() => setResetModalUser(null)} className="text-neutral-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleResetUserPassword} className="space-y-4">
              <p className="text-xs text-neutral-400">
                Estás asignando una nueva contraseña para el usuario <strong className="text-white">{resetModalUser.username}</strong>.
              </p>
              
              <div className="space-y-2">
                <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider">Nueva Contraseña</label>
                <Input 
                  type="password"
                  value={userNewPassword}
                  onChange={e => setUserNewPassword(e.target.value)}
                  required
                  placeholder="Mínimo 4 caracteres"
                  className="bg-neutral-950 border-neutral-800 text-white focus-visible:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setResetModalUser(null)}
                  className="w-1/2 h-10 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={userPassLoading}
                  className="w-1/2 h-10 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(217,119,6,0.4)]"
                >
                  {userPassLoading ? 'Guardando...' : 'Cambiar Clave'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

