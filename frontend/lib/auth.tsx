"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";

export type User = {
  id: string;
  name: string;
  email: string;
  has_access: boolean;
  plan?: string | null;
  is_admin?: boolean;
};

type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("djme_token");
    if (!t) {
      setLoading(false);
      return;
    }
    setToken(t);
    api
      .me(t)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("djme_token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = (t: string, u: User) => {
    localStorage.setItem("djme_token", t);
    setToken(t);
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    const d = await api.login(email, password);
    save(d.token, d.user);
  };

  const signup = async (name: string, email: string, password: string) => {
    const d = await api.signup(name, email, password);
    save(d.token, d.user);
  };

  const logout = () => {
    localStorage.removeItem("djme_token");
    setToken(null);
    setUser(null);
  };

  const refresh = async () => {
    const t = localStorage.getItem("djme_token");
    if (!t) return;
    const u = await api.me(t);
    setUser(u);
  };

  return (
    <Ctx.Provider value={{ user, token, loading, login, signup, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside provider");
  return v;
}
