import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALLOWED_DOMAIN, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function MicrosoftMark() {
  return (
    <span className="inline-grid grid-cols-2 gap-[2px]">
      <span className="h-2.5 w-2.5 bg-[#F25022]" />
      <span className="h-2.5 w-2.5 bg-[#7FBA00]" />
      <span className="h-2.5 w-2.5 bg-[#00A4EF]" />
      <span className="h-2.5 w-2.5 bg-[#FFB900]" />
    </span>
  );
}

function LoginPage() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const checkDomain = (e: string) => e.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!checkDomain(email)) {
      setError(`Alleen @${ALLOWED_DOMAIN} accounts zijn toegestaan.`);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name || email.split("@")[0] }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account aangemaakt. Even geduld…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Onbekende fout";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo size={56} />
            <h1 className="mt-4 text-2xl font-semibold text-foreground">WK 2026 Prono</h1>
            <p className="mt-1 text-sm text-muted-foreground">Interne challenge — WelZeker</p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full justify-center gap-3 border-border h-11"
            disabled
            title="Microsoft 365 sign-in wordt later toegevoegd"
          >
            <MicrosoftMark />
            <span>Aanmelden met Microsoft 365</span>
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            M365-aanmelding wordt binnenkort geactiveerd. Tot dan: e-mail + wachtwoord hieronder.
          </p>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> of <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Naam</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Voornaam Achternaam" required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`naam@${ALLOWED_DOMAIN}`} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Wachtwoord</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full h-11">
              {busy ? "Even geduld…" : mode === "signup" ? "Account aanmaken" : "Aanmelden"}
            </Button>
            <button type="button" onClick={() => { setMode(m => m === "signin" ? "signup" : "signin"); setError(null); }}
              className="block w-full pt-1 text-center text-xs text-muted-foreground hover:text-foreground">
              {mode === "signin" ? "Nog geen account? Account aanmaken" : "Al een account? Aanmelden"}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Toegang enkel met je <span className="font-semibold text-foreground">@{ALLOWED_DOMAIN}</span> e-mailadres.
          </p>
        </div>
      </div>
    </div>
  );
}
