import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PHASE_LABELS } from "@/lib/teams";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Lock, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ko-schema")({ component: KOSchema });

type Match = {
  id: string; match_number: number; phase: string;
  home_team: string; away_team: string; match_date: string; is_locked: boolean;
  actual_home_score: number | null; actual_away_score: number | null;
};
type Pred = { match_id: string; predicted_home_score: number; predicted_away_score: number };

const KO_PHASES = ["ronde32", "achtste", "kwart", "half", "derde", "finale"] as const;

function KOSchema() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ko", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const [m, p] = await Promise.all([
        supabase.from("matches").select("*").in("phase", KO_PHASES as any).order("match_number"),
        supabase.from("predictions").select("match_id,predicted_home_score,predicted_away_score").eq("user_id", profile!.id),
      ]);
      return { matches: (m.data ?? []) as Match[], preds: (p.data ?? []) as Pred[] };
    },
  });

  if (isLoading || !data) return <Skeleton className="h-96" />;
  const final = data.matches.find(m => m.phase === "finale");
  const finalPred = data.preds.find(p => p.match_id === final?.id);
  const champion = finalPred && final
    ? (finalPred.predicted_home_score > finalPred.predicted_away_score ? final.home_team
       : finalPred.predicted_away_score > finalPred.predicted_home_score ? final.away_team
       : "—")
    : null;

  return (
    <div className="space-y-6">
      <header>
        <div className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-wc-purple" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>Knock-out</span>
        </div>
        <h1 className="mt-1 text-3xl font-bold uppercase tracking-tight text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>KO-schema</h1>
        <p className="mt-1 text-sm text-muted-foreground">Voorspel de knock-out fase. Teams worden zichtbaar zodra de groepsfase afloopt.</p>
      </header>

      {champion && champion !== "—" && champion !== "TBD" && (
        <div className="tournament-surface relative overflow-hidden rounded-2xl p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-wc-gold" style={{ fontFamily: "'Oswald', sans-serif" }}>Jouw wereldkampioen</div>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <span className="text-2xl font-bold uppercase tracking-tight text-white" style={{ fontFamily: "'Oswald', sans-serif" }}>{champion}</span>
          </div>
        </div>
      )}

      {KO_PHASES.map(phase => (
        <PhaseBlock key={phase} phase={phase} matches={data.matches.filter(m => m.phase === phase)} preds={data.preds} userId={profile!.id} onSaved={() => qc.invalidateQueries({ queryKey: ["ko"] })} />
      ))}
    </div>
  );
}

function PhaseBlock({ phase, matches, preds, userId, onSaved }: { phase: string; matches: Match[]; preds: Pred[]; userId: string; onSaved: () => void }) {
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

  async function save() {
    setBusy(true);
    const rows = matches
      .filter(m => !m.is_locked && m.home_team !== "TBD")
      .map(m => ({ id: m.id, h: values[m.id]?.h, a: values[m.id]?.a }))
      .filter(r => r.h !== "" && r.a !== "");
    if (rows.length === 0) { setBusy(false); toast.error("Niets in te vullen."); return; }
    const payload = rows.map(r => ({
      user_id: userId, match_id: r.id,
      predicted_home_score: parseInt(r.h, 10) || 0,
      predicted_away_score: parseInt(r.a, 10) || 0,
    }));
    const { error } = await supabase.from("predictions").upsert(payload, { onConflict: "user_id,match_id" });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Opgeslagen"); onSaved(); }
  }

  const playable = matches.some(m => m.home_team !== "TBD" && !m.is_locked);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-wc-purple" />
          {PHASE_LABELS[phase]}
        </h2>
        <span className="text-[11px] text-muted-foreground">{matches.length} wedstrijd{matches.length !== 1 ? "en" : ""}</span>
      </div>
      <ul className="divide-y divide-border">
        {matches.map(m => {
          const tbd = m.home_team === "TBD";
          const v = values[m.id] ?? { h: "", a: "" };
          return (
            <li key={m.id} className={`px-3 py-3 ${tbd ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">{m.match_number}</span>
                <span className={`flex-1 truncate text-right text-sm font-medium ${tbd ? "border border-dashed border-border rounded px-2 py-0.5 text-muted-foreground" : "text-foreground"}`}>{m.home_team}</span>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} max={20} disabled={tbd || m.is_locked}
                    value={v.h} onChange={(e) => setValues(p => ({ ...p, [m.id]: { ...p[m.id], h: e.target.value.replace(/\D/g, "").slice(0,2) } }))}
                    className="score-input disabled:opacity-50" />
                  <span className="text-muted-foreground">–</span>
                  <input type="number" min={0} max={20} disabled={tbd || m.is_locked}
                    value={v.a} onChange={(e) => setValues(p => ({ ...p, [m.id]: { ...p[m.id], a: e.target.value.replace(/\D/g, "").slice(0,2) } }))}
                    className="score-input disabled:opacity-50" />
                </div>
                <span className={`flex-1 truncate text-left text-sm font-medium ${tbd ? "border border-dashed border-border rounded px-2 py-0.5 text-muted-foreground" : "text-foreground"}`}>{m.away_team}</span>
              </div>
              <div className="mt-1 pl-8 text-[10px] text-muted-foreground">
                {m.is_locked ? <span className="inline-flex items-center gap-1"><Lock className="h-2.5 w-2.5" />Gesloten</span> : formatDate(m.match_date)}
              </div>
            </li>
          );
        })}
      </ul>
      {playable && (
        <div className="border-t border-border px-3 py-3">
          <Button onClick={save} disabled={busy} size="sm" variant="outline" className="w-full"><Save className="mr-2 h-4 w-4" />{busy ? "Opslaan…" : `Opslaan ${PHASE_LABELS[phase]}`}</Button>
        </div>
      )}
    </section>
  );
}
