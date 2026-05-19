import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Target, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/klassement")({ component: Klassement });

type Row = { user_id: string; display_name: string; avatar_initials: string; total_match_points: number; total_bonus_points: number; grand_total: number; rank: number };

function Klassement() {
  const { profile } = useAuth();
  const [open, setOpen] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const lb = await supabase.from("leaderboard").select("*").order("rank");
      return (lb.data ?? []) as Row[];
    },
  });

  // Realtime updates: when admin enters scores or anyone predicts
  useEffect(() => {
    const ch = supabase.channel("leaderboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "bonus_results" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  if (isLoading || !data) return <Skeleton className="h-96" />;
  const me = data.find(r => r.user_id === profile?.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Klassement</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live geüpdatet zodra uitslagen binnenkomen.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard Icon={Trophy} label="Jouw positie" value={me ? `#${me.rank}` : "—"} accent />
        <SummaryCard Icon={Target} label="Wedstrijdpunten" value={String(me?.total_match_points ?? 0)} />
        <SummaryCard Icon={Star} label="Bonuspunten" value={String(me?.total_bonus_points ?? 0)} />
      </div>

      <section className="rounded-2xl border border-border bg-surface">
        {data.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nog geen deelnemers.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map(r => {
              const me = r.user_id === profile?.id;
              const isOpen = open === r.user_id;
              return (
                <li key={r.user_id}>
                  <button onClick={() => setOpen(isOpen ? null : r.user_id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 ${me ? "bg-primary-soft" : ""}`}>
                    <span className={`w-7 text-center text-sm font-bold ${r.rank === 1 ? "text-bonus-amber" : "text-muted-foreground"}`}>#{r.rank}</span>
                    <span className={`grid h-9 w-9 place-items-center rounded-full text-[12px] font-semibold ${me ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>{r.avatar_initials}</span>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-sm ${me ? "font-semibold text-primary" : "font-medium text-foreground"}`}>{r.display_name}{me ? " · jij" : ""}</div>
                      <div className="text-[11px] text-muted-foreground">{r.total_match_points} match + {r.total_bonus_points} bonus</div>
                    </div>
                    <span className="text-base font-semibold tabular-nums text-foreground">{r.grand_total}<span className="text-xs text-muted-foreground"> pt</span></span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                      <div className="flex justify-between"><span>Wedstrijdpunten</span><span className="font-semibold text-foreground">{r.total_match_points}</span></div>
                      <div className="mt-1 flex justify-between"><span>Bonuspunten</span><span className="font-semibold text-foreground">{r.total_bonus_points}</span></div>
                      <div className="mt-2 flex justify-between border-t border-border pt-2"><span>Totaal</span><span className="font-bold text-primary">{r.grand_total} pt</span></div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ Icon, label, value, accent }: { Icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${accent ? "border-primary bg-primary-soft" : "border-border bg-surface"}`}>
      <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      <div className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
