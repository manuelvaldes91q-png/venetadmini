import { create } from 'zustand';

interface StoreState {
  stats: any;
  clients: any[];
  routers: any[];
  profiles: any[];
  users: any[];
  leases: any[];
  settings: Record<string, string>;
  user: any | null;
  token: string | null;
  login: (token: string, user: any) => void;
  logout: () => void;
  initAuth: () => Promise<void>;
  fetchAuthAndData: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  fetchStats: () => Promise<void>;
  fetchClients: () => Promise<void>;
  fetchRouters: () => Promise<void>;
  fetchProfiles: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchLeases: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  saveSettings: (settings: Record<string, string>) => Promise<void>;
  addRouter: (router: any) => Promise<void>;
  deleteRouter: (id: string) => Promise<void>;
  addClient: (client: any) => Promise<void>;
  toggleClient: (id: string) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  updateClientProfile: (id: string, profileId: string) => Promise<void>;
  updateClientProvider: (id: string, provider: 'Inter' | 'Airtek' | null) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => {
  const fetchAuthAndData = async (input: RequestInfo | URL, init?: RequestInit) => {
    const { token, logout } = get();
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    
    const res = await fetch(input, { ...init, headers });
    if (res.status === 401) {
      logout();
    }
    return res;
  };

  return {
    stats: null,
    clients: [],
    routers: [],
    profiles: [],
    users: [],
    user: null,
    token: localStorage.getItem('nexus_token'),

    fetchAuthAndData,

    login: (token, user) => {
      localStorage.setItem('nexus_token', token);
      set({ token, user });
    },

    logout: () => {
      localStorage.removeItem('nexus_token');
      set({ token: null, user: null });
    },

    initAuth: async () => {
      const { token, logout } = get();
      if (!token) return;
      try {
        const res = await fetchAuthAndData('/api/auth/me');
        if (res.ok) {
          const { user } = await res.json();
          set({ user });
        } else {
          logout();
        }
      } catch {
        logout();
      }
    },

    fetchStats: async () => {
      try {
        const res = await fetchAuthAndData('/api/stats');
        if (res.ok) set({ stats: await res.json() });
      } catch (e) {}
    },

    fetchClients: async () => {
      try {
        const res = await fetchAuthAndData('/api/clients');
        if (res.ok) set({ clients: await res.json() });
      } catch(e) {}
    },

    fetchRouters: async () => {
      try {
        const res = await fetchAuthAndData('/api/routers');
        if (res.ok) set({ routers: await res.json() });
      } catch(e) {}
    },

    fetchProfiles: async () => {
      try {
        const res = await fetchAuthAndData('/api/profiles');
        if (res.ok) set({ profiles: await res.json() });
      } catch(e) {}
    },

    fetchUsers: async () => {
      try {
        const res = await fetchAuthAndData('/api/users');
        if (res.ok) set({ users: await res.json() });
      } catch(e) {}
    },

    leases: [],
    settings: {},

    fetchLeases: async () => {
      try {
        const res = await fetchAuthAndData('/api/leases');
        if (res.ok) set({ leases: await res.json() });
      } catch(e) {}
    },

    fetchSettings: async () => {
      try {
        const res = await fetchAuthAndData('/api/settings');
        if (res.ok) set({ settings: await res.json() });
      } catch(e) {}
    },

    saveSettings: async (settings) => {
      try {
        const res = await fetchAuthAndData('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        if (res.ok) {
          get().fetchSettings();
        } else {
          throw new Error((await res.json()).error);
        }
      } catch(e) { throw e; }
    },

    addRouter: async (routerData) => {
      try {
        const res = await fetchAuthAndData('/api/routers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(routerData)
        });
        if (res.ok) {
          get().fetchRouters();
        } else {
          throw new Error((await res.json()).error);
        }
      } catch(e) { throw e; }
    },

    deleteRouter: async (id) => {
      try {
        const res = await fetchAuthAndData(`/api/routers/${id}`, { method: 'DELETE' });
        if (res.ok) {
          get().fetchRouters();
        } else {
          throw new Error((await res.json()).error);
        }
      } catch(e) { throw e; }
    },

    addClient: async (clientData) => {
      try {
        const res = await fetchAuthAndData('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientData)
        });
        if (res.ok) {
          get().fetchClients();
        } else {
          throw new Error((await res.json()).error);
        }
      } catch(e) { throw e; }
    },

    deleteUser: async (id: string) => {
        try {
            const res = await fetchAuthAndData(`/api/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
                set((state) => ({ users: state.users.filter(u => u.id !== id) }));
            }
        } catch(e) {}
    },

    toggleClient: async (id) => {
      try {
        const res = await fetchAuthAndData(`/api/clients/${id}/toggle`, { method: 'POST' });
        if (res.ok) {
          const { newStatus } = await res.json();
          set((state) => ({
            clients: state.clients.map(c => 
              c.id === id ? { ...c, disabled: newStatus === 'cut' ? 1 : 0, status: newStatus } : c
            )
          }));
        } else {
            throw new Error((await res.json()).error || 'Failed');
        }
      } catch (e) {
          throw e;
      }
    },

    deleteClient: async (id) => {
      try {
        const res = await fetchAuthAndData(`/api/clients/${id}`, { method: 'DELETE' });
        if (res.ok) {
          get().fetchClients();
          get().fetchStats();
        } else {
          throw new Error((await res.json()).error || 'Failed');
        }
      } catch (e) {
        throw e;
      }
    },

    updateClientProfile: async (id, profileId) => {
       try {
         const res = await fetchAuthAndData(`/api/clients/${id}/profile`, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ profileId })
         });
         if (res.ok) {
             get().fetchClients();
         } else {
             throw new Error((await res.json()).error || 'Failed');
         }
       } catch (e) { throw e; }
    },

    updateClientProvider: async (id, provider) => {
       try {
         const res = await fetchAuthAndData(`/api/clients/${id}/provider`, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ provider })
         });
         if (res.ok) {
             get().fetchClients();
         } else {
             throw new Error((await res.json()).error || 'Failed');
         }
       } catch (e) { throw e; }
    }
  };
});
