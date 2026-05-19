import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { ArrowRight, Trophy, Lock } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
      await signIn(trimmedName, trimmedEmail);
      nav({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-screen w-full place-items-center overflow-hidden bg-[#050505] p-4 sm:p-6">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-1/4 -left-1/4 h-[60%] w-[60%] rounded-full bg-wc-purple opacity-20 blur-[140px]" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[60%] w-[60%] rounded-full bg-wc-lime opacity-[0.12] blur-[140px]" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="wc26-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M0 40 L40 0 L80 40 L40 80 Z" fill="none" stroke="white" strokeWidth="1" />
              <circle cx="40" cy="40" r="2" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wc26-pattern)" />
        </svg>
      </div>

      {/* Floating decoratives */}
      <div className="pointer-events-none absolute bottom-10 left-10 h-24 w-24 rounded-full border-4 border-wc-purple/10 animate-pulse" />
      <div className="pointer-events-none absolute top-10 right-10 h-32 w-32 rotate-45 rounded-3xl border-4 border-wc-lime/10 animate-pulse" />

      <div className="relative z-10 w-full max-w-[420px] rounded-[2rem] bg-white p-8 shadow-2xl sm:p-10">
        <div className="flex flex-col items-center text-center">
          {/* Logo mark */}
          <div className="relative mb-7 group">
            <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-wc-purple via-wc-lime to-primary opacity-25 blur-xl transition-opacity duration-500 group-hover:opacity-50" />
            <div className="relative flex h-20 w-20 rotate-3 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">
              <span className="absolute inset-0 flex items-center justify-center text-6xl tracking-tighter text-white/25 select-none" style={{ fontFamily: "'Archivo Black', sans-serif" }}>26</span>
              <Trophy className="relative z-10 h-9 w-9 text-wc-gold drop-shadow-[0_0_8px_rgba(218,176,76,0.6)]" />
            </div>
          </div>

          <h1 className="mb-1 text-3xl font-black uppercase leading-none tracking-tight text-black sm:text-4xl" style={{ fontFamily: "'Oswald', sans-serif" }}>
            WK 2026 <span className="text-wc-purple">Prono</span>
          </h1>
          <p className="mb-9 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Interne Challenge <span className="mx-2 text-slate-300">|</span> <span className="text-black">WelZeker</span>
          </p>

          <form onSubmit={onSubmit} className="w-full space-y-4 text-left">
            <div className="space-y-1.5">
              <label htmlFor="name" className="ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Volledige naam</label>
              <input
                id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Jan Janssens" autoComplete="name" required maxLength={80}
                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-300 transition-all focus:border-wc-purple focus:outline-none focus:ring-4 focus:ring-wc-purple/10"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">E-mailadres</label>
              <input
                id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@welzeker.be" autoComplete="email" required maxLength={120}
                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-300 transition-all focus:border-wc-purple focus:outline-none focus:ring-4 focus:ring-wc-purple/10"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={busy}
              className="group mt-2 flex h-auto w-full items-center justify-center gap-3 rounded-2xl bg-black py-5 text-sm font-extrabold uppercase tracking-wider text-white shadow-xl shadow-black/10 transition-all hover:bg-wc-purple active:scale-[0.97]">
              <span>{busy ? "Even geduld…" : "Deelnemen aan WK"}</span>
              {!busy && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
            </Button>
          </form>

          <div className="mt-9 flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-wc-lime text-black">
              <Lock className="h-4 w-4" strokeWidth={3} />
            </span>
            <p className="text-left text-[10px] font-medium uppercase leading-snug tracking-tight text-slate-500">
              Geen wachtwoord vereist. <span className="font-bold text-black">Eenvoudige toegang</span> via e-mail op al je toestellen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
