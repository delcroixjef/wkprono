import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { checkJoinCode } from "@/lib/access.functions";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const nav = useNavigate();
  const validate = useServerFn(checkJoinCode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) return setError("Vul je voornaam en achternaam in.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return setError("Geef een geldig e-mailadres in.");

    setBusy(true);
    try {
      const r = await validate({ data: { code } });
      if (!r.ok) {
        setError(r.message ?? "Ongeldige deelnamecode.");
        setBusy(false);
        return;
      }
      await signIn(trimmedName, trimmedEmail);
      nav({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-surface p-7 shadow-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo size={52} />
            <h1 className="mt-4 text-xl font-semibold text-foreground">WK 2026 Prono</h1>
            <p className="mt-1 text-sm text-muted-foreground">Interne challenge — WelZeker</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Voornaam + naam</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Jan Janssens" autoComplete="name" required maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mailadres</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="jan@voorbeeld.be" autoComplete="email" required maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Deelnamecode</Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="Vraag aan de organisator" autoComplete="off" maxLength={64} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full h-11">
              {busy ? "Even geduld…" : (<>Deelnemen <ArrowRight className="ml-1.5 h-4 w-4" /></>)}
            </Button>
          </form>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Geen wachtwoord nodig. Vul dezelfde gegevens in op elk toestel.
          </p>
        </div>
      </div>
    </div>
  );
}
