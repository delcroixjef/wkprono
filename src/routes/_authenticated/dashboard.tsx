import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { greeting, formatDateTime, timeUntil } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Clock, Trophy, ListChecks } from "lucide-react";
import { SectionEyebrow } from "@/components/wc/SectionEyebrow";
import { TournamentCard, WCNumber, DisplayHeading } from "@/components/wc/TournamentCard";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

type Match = { id: string; match_number: number; phase: string; group_code: string | null; home_team: string; away_team: string; match_date: string; is_locked: boolean };

function Dashboard() {
  const { profile } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const [matchesRes, predsRes, lbRes] = await Promise.all([
        supabase.from("matches").select("id,match_number,phase,group_code,home_team,away_team,match_date,is_locked").order("match_number"),
        supabase.from("predictions").select("match_id,points_earned").eq("user_id", profile!.id),
        supabase.from("leaderboard").select("*").order("rank"),
      ]);
      return {
        matches: (matchesRes.data ?? []) as Match[],
        predictions: predsRes.data ?? [],
        leaderboard: lbRes.data ?? [],
      };
    },
  });

  if (isLoading || !data) return <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;

  const predIds = new Set(data.predictions.map(p => p.match_id));
  const pending = data.matches.filter(m => !m.is_locked && !predIds.has(m.id) && m.home_team !== "TBD").slice(0, 5);
  const my = data.leaderboard.find((r: any) => r.user_id === profile?.id);
  const totalPoints = my?.grand_total ?? 0;
  const rank = my?.rank ?? "—";
  const openCount = data.matches.filter(m => !m.is_locked && !predIds.has(m.id) && m.home_team !== "TBD").length;

  return (
    <div className="space-y-6">
      <section>
        <SectionEyebrow accent="purple">Matchday · {greeting()}</SectionEyebrow>
        <DisplayHeading className="mt-2 text-4xl font-bold text-foreground sm:text-5xl">
          {profile?.display_name?.split(" ")[0]}
        </DisplayHeading>
        <p className="mt-1 text-sm text-muted-foreground">Groepsfase loopt nog. Doe je voorspellingen in.</p>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <TournamentCard className="col-span-1 !p-4">
          <div className="wc-eyebrow text-white/60" style={{ fontFamily: "'Oswald', sans-serif" }}>Jouw punten</div>
          <WCNumber className="mt-1 block text-4xl text-wc-lime">{totalPoints}</WCNumber>
        </TournamentCard>
        <Stat label="Positie" value={`#${rank}`} />
        <Stat label="Openstaand" value={String(openCount)} />
      </section>

      <section className="rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" />Te voorspellen</h2>
          <Link to="/prono" className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">Alle wedstrijden <ArrowRight className="h-3 w-3" /></Link>
        </div>
        {pending.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Alles ingevuld 🎉</p>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map(m => {
              const tu = timeUntil(m.match_date);
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">{m.match_number}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{m.home_team} <span className="text-muted-foreground">vs</span> {m.away_team}</div>
                    <div className="text-[11px] text-muted-foreground">{formatDateTime(m.match_date)}{m.group_code ? ` · Groep ${m.group_code}` : ""}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tu.urgent ? "bg-destructive/10 text-destructive" : "bg-bonus-amber/15 text-[color:var(--bonus-amber)]"}`}>
                    <Clock className="h-3 w-3" />{tu.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" />Klassement</h2>
          <Link to="/klassement" className="text-xs font-medium text-primary hover:underline">Volledig →</Link>
        </div>
        <LeaderboardChart rows={data.leaderboard} currentUserId={profile?.id} />
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${accent ? "border-primary bg-primary-soft" : "border-border bg-surface"}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function LeaderboardChart({ rows, currentUserId }: { rows: any[]; currentUserId?: string }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nog geen deelnemers.</p>;
  const max = Math.max(1, ...rows.map(r => r.grand_total ?? 0));
  return (
    <ul className="space-y-2 px-4 py-4">
      {rows.slice(0, 10).map((r) => {
        const pct = ((r.grand_total ?? 0) / max) * 100;
        const me = r.user_id === currentUserId;
        return (
          <li key={r.user_id} className="flex items-center gap-3">
            <span className="w-6 text-right text-xs font-semibold text-muted-foreground">#{r.rank}</span>
            <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold ${me ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>{r.avatar_initials}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`truncate text-sm ${me ? "font-semibold text-primary" : "text-foreground"}`}>{r.display_name}{me ? " (jij)" : ""}</span>
                <span className="text-xs font-semibold tabular-nums text-foreground">{r.grand_total ?? 0} pt</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${me ? "bg-primary" : "bg-foreground/30"}`} style={{ width: `${Math.max(2, pct)}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
