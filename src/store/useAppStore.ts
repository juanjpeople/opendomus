import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'admin' | 'adult' | 'kid';
export type Theme = 'light' | 'dark' | 'system';
export type Skin = 'auto' | 'desktop' | 'mobile' | 'kids';

interface AppState {
  // Auth / Security
  currentUser: {
    id: string;
    name: string;
    role: Role;
  } | null;
  login: (name: string, role: Role) => void;
  logout: () => void;

  // Preferences
  theme: Theme;
  setTheme: (theme: Theme) => void;
  
  skin: Skin;
  setSkin: (skin: Skin) => void;

  // Customization
  brandColor: string;
  setBrandColor: (color: string) => void;
  borderRadius: number;
  setBorderRadius: (radius: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: { id: '1', name: 'Admin', role: 'admin' }, 
      login: (name, role) => set({ currentUser: { id: crypto.randomUUID(), name, role } }),
      logout: () => set({ currentUser: null }),

      theme: 'system',
      setTheme: (theme) => set({ theme }),

      skin: 'auto',
      setSkin: (skin) => set({ skin }),

      brandColor: '#1677ff',
      setBrandColor: (brandColor) => set({ brandColor }),
      borderRadius: 8,
      setBorderRadius: (borderRadius) => set({ borderRadius }),
    }),
    {
      name: 'opendomus-app-storage',
    }
  )
);
