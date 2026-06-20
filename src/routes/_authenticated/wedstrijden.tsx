import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PHASE_LABELS, GROUP_CODES } from "@/lib/teams";
import { formatDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { MatchStatusBadge } from "@/components/MatchStatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/wedstrijden")({ component: WedstrijdenPage });

type Match = {
  id: string; match_number: number; phase: string; group_code: string | null;
  home_team: string; away_team: string; match_date: string;
  actual_home_score: number | null; actual_away_score: number | null;
  is_locked: boolean; source: string;
};
type Pred = { match_id: string; predicted_home_score: number; predicted_away_score: number; user_id: string };
type Profile = { id: string; display_name: string; avatar_initials: string };

function WedstrijdenPage() {
  const { profile } = useAuth();
  const [phase, setPhase] = useState<string>("all");
  const [group, setGroup] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["wedstrijden", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      // Predictions kunnen >1000 zijn (Supabase default limit). Paginate via .range().
      const fetchAllPreds = async () => {
        const pageSize = 1000;
        const all: Pred[] = [];
        for (let from = 0; ; from += pageSize) {
          const { data: chunk, error } = await supabase
            .from("predictions")
            .select("match_id,predicted_home_score,predicted_away_score,user_id")
            .range(from, from + pageSize - 1);
          if (error) throw error;
          const rows = (chunk ?? []) as Pred[];
          all.push(...rows);
          if (rows.length < pageSize) break;
        }
        return all;
      };
      const [m, preds, pr] = await Promise.all([
        supabase.from("matches").select("*").order("match_date"),
        fetchAllPreds(),
        supabase.from("profiles").select("id,display_name,avatar_initials"),
      ]);
      return {
        matches: (m.data ?? []) as Match[],
        preds,
        profiles: (pr.data ?? []) as Profile[],
      };
    },
    refetchInterval: 60_000,
  });

  if (isLoading || !data) return <Skeleton className="h-96" />;

  const filtered = data.matches.filter((m) => {
    if (phase !== "all" && m.phase !== phase) return false;
    if (group !== "all" && m.group_code !== group) return false;
    if (status === "open" && (m.is_locked || m.actual_home_score !== null)) return false;
    if (status === "closed" && !m.is_locked) return false;
    if (status === "result" && m.actual_home_score === null) return false;
    return true;
  });

  const profById = new Map(data.profiles.map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Wedstrijden</h1>
        <p className="mt-1 text-sm text-muted-foreground">Alle uitslagen en — na aftrap — de voorspellingen van collega's.</p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <FilterSelect value={phase} onChange={setPhase} placeholder="Alle fases" options={[
          { v: "all", l: "Alle fases" },
          ...Object.entries(PHASE_LABELS).map(([v, l]) => ({ v, l })),
        ]} />
        <FilterSelect value={group} onChange={setGroup} placeholder="Alle groepen" options={[
          { v: "all", l: "Alle groepen" },
          ...GROUP_CODES.map((g) => ({ v: g, l: `Groep ${g}` })),
        ]} />
        <FilterSelect value={status} onChange={setStatus} placeholder="Status" options={[
          { v: "all", l: "Alle statussen" },
          { v: "open", l: "Open" },
          { v: "closed", l: "Gesloten" },
          { v: "result", l: "Met uitslag" },
        ]} />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg bg-muted px-4 py-8 text-center text-sm text-muted-foreground">Geen wedstrijden voor deze filters.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              preds={data.preds.filter((p) => p.match_id === m.id)}
              profiles={profById}
              currentUserId={profile?.id ?? ""}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  options: { v: string; l: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function MatchCard({ match, preds, profiles, currentUserId }: {
  match: Match; preds: Pred[]; profiles: Map<string, Profile>; currentUserId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasResult = match.actual_home_score !== null;
  const afterKickoff = new Date(match.match_date).getTime() <= Date.now();
  const myPred = preds.find((p) => p.user_id === currentUserId);

  // distribution post-kickoff
  const dist = new Map<string, number>();
  if (afterKickoff) {
    for (const p of preds) {
      const k = `${p.predicted_home_score}-${p.predicted_away_score}`;
      dist.set(k, (dist.get(k) ?? 0) + 1);
    }
  }
  const distSorted = [...dist.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <li className="rounded-lg border border-border bg-surface">
      <button onClick={() => setExpanded((v) => !v)} className="w-full text-left p-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
            {match.match_number}
          </span>
          <span className="flex-1 truncate text-right text-sm font-medium text-foreground">{match.home_team}</span>
          <span className="px-2 text-sm font-semibold tabular-nums text-foreground">
            {hasResult ? `${match.actual_home_score} – ${match.actual_away_score}` : "vs"}
          </span>
          <span className="flex-1 truncate text-left text-sm font-medium text-foreground">{match.away_team}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 pl-8 text-[11px] text-muted-foreground">
          <span>{formatDateTime(match.match_date)}{match.group_code ? ` · Groep ${match.group_code}` : ""}</span>
          <MatchStatusBadge matchDate={match.match_date} isLocked={match.is_locked} hasResult={hasResult} source={match.source} />
        </div>
        {myPred && (
          <div className="mt-1 pl-8 text-[11px] text-muted-foreground">
            Jouw voorspelling: <span className="font-semibold text-foreground">{myPred.predicted_home_score} – {myPred.predicted_away_score}</span>
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-3 text-xs">
          {!afterKickoff ? (
            <p className="text-muted-foreground">Voorspellingen van collega's worden zichtbaar na de aftrap.</p>
          ) : preds.length === 0 ? (
            <p className="text-muted-foreground">Nog geen voorspellingen ingevuld.</p>
          ) : (
            <>
              <div className="mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Verdeling</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {distSorted.map(([k, n]) => (
                    <span key={k} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px]">
                      <span className="font-semibold tabular-nums">{n}×</span>
                      <span className="text-muted-foreground">{k}</span>
                    </span>
                  ))}
                </div>
              </div>
              <ul className="divide-y divide-border">
                {preds.map((p) => {
                  const prof = profiles.get(p.user_id);
                  if (!prof) return null;
                  const correct = hasResult &&
                    p.predicted_home_score === match.actual_home_score &&
                    p.predicted_away_score === match.actual_away_score;
                  return (
                    <li key={p.user_id} className="flex items-center gap-2 py-1.5">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-[10px] font-semibold text-foreground">{prof.avatar_initials}</span>
                      <span className="flex-1 truncate text-foreground">{prof.display_name}</span>
                      <span className={`tabular-nums font-semibold ${correct ? "text-success" : "text-foreground"}`}>
                        {p.predicted_home_score} – {p.predicted_away_score}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </li>
  );
}
