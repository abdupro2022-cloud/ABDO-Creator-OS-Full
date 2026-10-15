import { create } from "zustand";
import type { SessionUser } from "@abdo/shared";
import { api } from "./api";

const STORAGE_KEY = "abdo.session";

interface PersistedSession {
  token: string;
  user: SessionUser;
}

interface AuthState {
  token: string | null;
  user: SessionUser | null;
  hydrated: boolean;
  hydrate(): void;
  setSession(token: string, user: SessionUser): void;
  signOut(): Promise<void>;
}

function load(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

function save(s: PersistedSession | null): void {
  if (typeof window === "undefined") return;
  if (s) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else window.localStorage.removeItem(STORAGE_KEY);
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  hydrate: () => {
    const s = load();
    set({ token: s?.token ?? null, user: s?.user ?? null, hydrated: true });
  },
  setSession: (token, user) => {
    save({ token, user });
    set({ token, user });
  },
  signOut: async () => {
    try {
      await api.post("/auth/signout");
    } catch {
      /* ignore */
    }
    save(null);
    set({ token: null, user: null });
  },
}));
