import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { GROUP_CODES, PHASE_LABELS } from "@/lib/teams";
import { formatDateTime, timeUntil } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Lock, Save, Star, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/prono")({ component: PronoPage });

type Match = {
  id: string; match_number: number; phase: string; group_code: string | null;
  home_team: string; away_team: string; match_date: string;
  actual_home_score: number | null; actual_away_score: number | null; is_locked: boolean;
};
type Pred = { match_id: string; predicted_home_score: number; predicted_away_score: number; points_earned: number | null };

function PronoPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("A");

  const { data, isLoading } = useQuery({
    queryKey: ["prono", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const [m, p] = await Promise.all([
        supabase.from("matches").select("*").order("match_number"),
        supabase.from("predictions").select("match_id,predicted_home_score,predicted_away_score,points_earned").eq("user_id", profile!.id),
      ]);
      return { matches: (m.data ?? []) as Match[], preds: (p.data ?? []) as Pred[] };
    },
  });

  const tabs = useMemo(() => ([
    ...GROUP_CODES.map(c => ({ id: c, label: `Groep ${c}` })),
    { id: "ronde32", label: "R32" }, { id: "achtste", label: "1/8" },
    { id: "kwart", label: "1/4" }, { id: "half", label: "1/2" },
    { id: "derde", label: "3e" }, { id: "finale", label: "Finale" },
  ]), []);

  if (isLoading || !data) return <Skeleton className="h-96" />;

  const filtered = data.matches.filter(m =>
    GROUP_CODES.includes(tab) ? m.group_code === tab : m.phase === tab
  );

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Mijn prono</h1>
          <p className="mt-1 text-sm text-muted-foreground">Vul je voorspellingen in. Opgeslagen ✅</p>
        </div>
        <div className="flex gap-2">
          <Link to="/bonus" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50">
            <Star className="h-3.5 w-3.5 text-[color:var(--bonus-amber)]" /> Bonusvragen
          </Link>
          <Link to="/ko-schema" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50">
            <Trophy className="h-3.5 w-3.5 text-primary" /> KO-schema
          </Link>
        </div>
      </header>

      <div className="overflow-x-auto -mx-1">
        <div className="flex gap-1 px-1 pb-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <PredictionsBlock matches={filtered} preds={data.preds} userId={profile!.id} onSaved={() => qc.invalidateQueries({ queryKey: ["prono"] })} />
    </div>
  );
}

function PredictionsBlock({ matches, preds, userId, onSaved }: { matches: Match[]; preds: Pred[]; userId: string; onSaved: () => void }) {
  const initial = useMemo(() => {
    const map: Record<string, { h: string; a: string }> = {};
    matches.forEach(m => {
      const p = preds.find(x => x.match_id === m.id);
      map[m.id] = { h: p ? String(p.predicted_home_score) : "", a: p ? String(p.predicted_away_score) : "" };
    });
    return map;
  }, [matches, preds]);

  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setValues(initial); }, [initial]);

  const update = (id: string, side: "h" | "a", v: string) => {
    const clean = v.replace(/[^0-9]/g, "").slice(0, 2);
    setValues(prev => ({ ...prev, [id]: { ...prev[id], [side]: clean } }));
  };

  async function save() {
    setBusy(true);
    // Speeldag-deadline: 30 min vóór eerste match van dezelfde Brusselse kalenderdag
    const LOCK_BUFFER_MS = 30 * 60 * 1000;
    const dayKey = (iso: string) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(new Date(iso));
      return `${parts.find(p=>p.type==="year")!.value}-${parts.find(p=>p.type==="month")!.value}-${parts.find(p=>p.type==="day")!.value}`;
    };
    const firstByDay = new Map<string, number>();
    for (const m of matches) {
      const k = dayKey(m.match_date);
      const t = new Date(m.match_date).getTime();
      const cur = firstByDay.get(k);
      if (cur === undefined || t < cur) firstByDay.set(k, t);
    }
    const now = Date.now();
    const rows = matches
      .filter(m => {
        if (m.is_locked) return false;
        const first = firstByDay.get(dayKey(m.match_date)) ?? new Date(m.match_date).getTime();
        return now < first - LOCK_BUFFER_MS;
      })
      .map(m => ({ id: m.id, h: values[m.id]?.h, a: values[m.id]?.a }))
      .filter(r => r.h !== "" && r.a !== "");
    if (rows.length === 0) { setBusy(false); toast.error("Deadline verstreken of niets in te vullen."); return; }

    const payload = rows.map(r => ({
      user_id: userId, match_id: r.id,
      predicted_home_score: Math.min(20, Math.max(0, parseInt(r.h, 10) || 0)),
      predicted_away_score: Math.min(20, Math.max(0, parseInt(r.a, 10) || 0)),
    }));
    const { error } = await supabase.from("predictions").upsert(payload, { onConflict: "user_id,match_id" });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(`${rows.length} voorspelling${rows.length > 1 ? "en" : ""} opgeslagen`); onSaved(); }
  }

  if (matches.length === 0) return <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">Geen wedstrijden in deze fase.</p>;

  // Group by Brussels-calendar day
  const dayKey = (iso: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date(iso));
    return `${parts.find(p=>p.type==="year")!.value}-${parts.find(p=>p.type==="month")!.value}-${parts.find(p=>p.type==="day")!.value}`;
  };
  const byDay = new Map<string, Match[]>();
  matches.forEach(m => {
    const k = dayKey(m.match_date);
    byDay.set(k, [...(byDay.get(k) ?? []), m]);
  });
  const LOCK_BUFFER_MS = 30 * 60 * 1000;

  return (
    <div className="space-y-4">
      {[...byDay.entries()].map(([day, list]) => {
        const sorted = [...list].sort((a, b) => +new Date(a.match_date) - +new Date(b.match_date));
        const firstKickoff = new Date(sorted[0].match_date).getTime();
        const deadlineMs = firstKickoff - LOCK_BUFFER_MS;
        const deadlineISO = new Date(deadlineMs).toISOString();
        const dayLocked = Date.now() >= deadlineMs || sorted.every(m => m.is_locked);
        return (
        <div key={day} className="rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{formatDateTime(sorted[0].match_date)}</span>
            <DeadlineChip iso={deadlineISO} locked={dayLocked} />
          </div>
          <ul className="divide-y divide-border">
            {sorted.map(m => {
              const pred = preds.find(p => p.match_id === m.id);
              const v = values[m.id] ?? { h: "", a: "" };
              const saved = pred && v.h === String(pred.predicted_home_score) && v.a === String(pred.predicted_away_score) && v.h !== "";
              const hasActual = m.actual_home_score !== null && m.actual_away_score !== null;
              const points = pred?.points_earned;
              const disabled = dayLocked || m.is_locked || m.home_team === "TBD";

              return (
                <li key={m.id} className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">{m.match_number}</span>
                    <span className="flex-1 truncate text-right text-sm font-medium text-foreground">{m.home_team}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" inputMode="numeric" min={0} max={20}
                        value={v.h} onChange={(e) => update(m.id, "h", e.target.value)}
                        disabled={disabled}
                        className={`score-input ${saved ? "score-input-saved" : ""} disabled:opacity-60`}
                      />
                      <span className="text-muted-foreground">–</span>
                      <input
                        type="number" inputMode="numeric" min={0} max={20}
                        value={v.a} onChange={(e) => update(m.id, "a", e.target.value)}
                        disabled={disabled}
                        className={`score-input ${saved ? "score-input-saved" : ""} disabled:opacity-60`}
                      />
                    </div>
                    <span className="flex-1 truncate text-left text-sm font-medium text-foreground">{m.away_team}</span>
                  </div>
                  {(hasActual || disabled) && (
                    <div className="mt-2 flex items-center justify-between pl-8 text-[11px]">
                      {hasActual ? (
                        <span className="text-muted-foreground">
                          Uitslag: <span className="font-semibold text-foreground">{m.actual_home_score} – {m.actual_away_score}</span>
                        </span>
                      ) : <span className="text-muted-foreground inline-flex items-center gap-1"><Lock className="h-3 w-3" />Vergrendeld</span>}
                      {points !== null && points !== undefined && (
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${points > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                          {points > 0 ? `+${points}` : "0"} pt
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        );
      })}

      <div className="sticky bottom-16 z-10">
        <Button onClick={save} disabled={busy} className="w-full h-11 shadow-lg">
          <Save className="mr-2 h-4 w-4" />{busy ? "Opslaan…" : "Opslaan"}
        </Button>
      </div>
    </div>
  );
}

function DeadlineChip({ iso, locked }: { iso: string; locked: boolean }) {
  if (locked) return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"><Lock className="h-3 w-3" />Gesloten</span>;
  const tu = timeUntil(iso);
  if (tu.expired) return <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">Sluit binnenkort</span>;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tu.urgent ? "bg-destructive/10 text-destructive" : "bg-bonus-amber/15 text-[color:var(--bonus-amber)]"}`}>Sluit in {tu.label}</span>;
}
