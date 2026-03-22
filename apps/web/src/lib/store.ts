import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_url?: string;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  demoMode: boolean;
  toggleDemoMode: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('rp_user') || 'null')
    : null,
  setUser: (user) => {
    set({ user });
    if (typeof window !== 'undefined') {
      if (user) localStorage.setItem('rp_user', JSON.stringify(user));
      else localStorage.removeItem('rp_user');
    }
  },
  toasts: [],
  addToast: (toast) => set((state) => ({
    toasts: [...state.toasts, { ...toast, id: Math.random().toString(36).slice(2) }]
  })),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),
  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  demoMode: false,
  toggleDemoMode: () => set((state) => ({ demoMode: !state.demoMode })),
}));
