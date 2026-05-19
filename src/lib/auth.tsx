import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  display_name: string;
  email: string;
  avatar_initials: string;
  is_admin: boolean;
  profile_confirmed: boolean;
};

type StoredSession = { user_id: string; display_name: string; email: string };

type AuthCtx = {
  user: { id: string } | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (name: string, email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const STORAGE_KEY = "wk2026_session";

const Ctx = createContext<AuthCtx>({
  user: null, profile: null, loading: true,
  signIn: async () => {},
  refreshProfile: async () => {},
  signOut: async () => {},
});

function readSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch { return null; }
}

function makeInitials(name: string, email: string) {
  const src = name.trim() || email.split("@")[0];
  const parts = src.split(/\s+/).filter(Boolean);
  const letters = (parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2));
  return letters.toUpperCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (id: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  };

  useEffect(() => {
    const sess = readSession();
    if (sess?.user_id) {
      loadProfile(sess.user_id).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (name: string, email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    if (!cleanEmail || !cleanName) throw new Error("Vul je naam en e-mailadres in.");

    const { data: existing, error: selErr } = await supabase
      .from("profiles").select("*").eq("email", cleanEmail).maybeSingle();
    if (selErr) throw selErr;

    let prof = existing as Profile | null;
    const initials = makeInitials(cleanName, cleanEmail);

    if (!prof) {
      const { data, error } = await supabase
        .from("profiles")
        .insert({ email: cleanEmail, display_name: cleanName, avatar_initials: initials, profile_confirmed: true })
        .select("*").single();
      if (error) throw error;
      prof = data as Profile;
    } else if (prof.display_name !== cleanName) {
      const { data } = await supabase
        .from("profiles")
        .update({ display_name: cleanName, avatar_initials: initials })
        .eq("id", prof.id).select("*").single();
      if (data) prof = data as Profile;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      user_id: prof.id, display_name: prof.display_name, email: prof.email,
    }));
    setProfile(prof);
  };

  const signOut = async () => {
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
  };

  return (
    <Ctx.Provider value={{
      user: profile ? { id: profile.id } : null,
      profile, loading, signIn,
      refreshProfile: async () => { const s = readSession(); if (s) await loadProfile(s.user_id); },
      signOut,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
