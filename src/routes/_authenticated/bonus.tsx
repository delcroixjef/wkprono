import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ALL_TEAMS, TOP_10_FAVORITES } from "@/lib/teams";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trophy, Shield, ChevronDown, CircleSlash, Flame, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bonus")({ component: BonusPage });

type Bonus = {
  topscorer_country: string | null;
  clean_sheet_country: string | null;
  early_exit_country: string | null;
  final_home_team: string | null;
  final_away_team: string | null;
  final_home_score: number | null;
  final_away_score: number | null;
  is_locked: boolean;
};

const EMPTY: Bonus = {
  topscorer_country: null, clean_sheet_country: null, early_exit_country: null,
  final_home_team: null, final_away_team: null,
  final_home_score: null, final_away_score: null, is_locked: false,
};

function BonusPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [data, setData] = useState<Bonus>(EMPTY);
  const [busy, setBusy] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["bonus", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data: b } = await supabase.from("bonus_predictions").select("*").eq("user_id", profile!.id).maybeSingle();
      if (b) setData(b as Bonus);
      return b;
    },
  });

  const set = <K extends keyof Bonus>(k: K, v: Bonus[K]) => setData(prev => ({ ...prev, [k]: v }));
  const filled = [data.topscorer_country, data.clean_sheet_country, data.early_exit_country,
    (data.final_home_team && data.final_home_score !== null) ? 1 : null].filter(v => v !== null && v !== "").length;

  async function save() {
    if (!profile) return;
    setBusy(true);
    const payload = { ...data, user_id: profile.id };
    const { error } = await supabase.from("bonus_predictions").upsert(payload, { onConflict: "user_id" });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Bonus opgeslagen"); qc.invalidateQueries({ queryKey: ["bonus"] }); }
  }

  if (isLoading) return <Skeleton className="h-96" />;
  const locked = data.is_locked;

  return (
    <div className="space-y-5 pb-24">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Bonusvragen</h1>
        <p className="mt-1 text-sm text-muted-foreground">In te vullen vóór 11 juni 2026 — 21:00. Max 33 pt.</p>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filled} / 4 ingevuld</span>
            <span>{Math.round((filled / 4) * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${(filled / 4) * 100}%` }} />
          </div>
        </div>
      </header>

      {/* Card 1 — Topscorer */}
      <BonusCard color="primary" Icon={Trophy} points={5} title="Topscorer" subtitle="Welk land levert de topscorer?">
        <CountrySelect value={data.topscorer_country} onChange={(v) => set("topscorer_country", v)} disabled={locked} />
      </BonusCard>

      {/* Card 2 — Clean sheets */}
      <BonusCard color="info" Icon={Shield} points={5} title="Meeste clean sheets" subtitle="Welk land houdt het vaakst de nul? Bij ex aequo zijn alle landen met dat maximum correct.">
        <CountrySelect value={data.clean_sheet_country} onChange={(v) => set("clean_sheet_country", v)} disabled={locked} />
      </BonusCard>

      {/* Card 3 — Early exit */}
      <BonusCard color="amber" Icon={ChevronDown} points={8} title="Vroege thuisreis" subtitle="Welke top-10 favoriet valt al in de groepsfase? Gaan alle top-10 door? Dan is 'Geen' ook correct.">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {TOP_10_FAVORITES.map(c => (
            <button key={c} type="button" disabled={locked} onClick={() => set("early_exit_country", c)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${data.early_exit_country === c ? "border-bonus-amber bg-bonus-amber/15 text-foreground" : "border-border bg-surface text-muted-foreground hover:bg-muted/50"} disabled:opacity-60`}>
              {c}
            </button>
          ))}
          <button type="button" disabled={locked} onClick={() => set("early_exit_country", "geen")}
            className={`col-span-3 sm:col-span-5 inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${data.early_exit_country === "geen" ? "border-bonus-amber bg-bonus-amber/15 text-foreground" : "border-dashed border-border bg-surface text-muted-foreground hover:bg-muted/50"} disabled:opacity-60`}>
            <CircleSlash className="h-3.5 w-3.5" />Geen uitschakeling
          </button>
        </div>
      </BonusCard>


      {/* Card 5 — Final exact score */}
      <BonusCard color="purple" Icon={Trophy} points={15} title="Exacte eindstand finale" subtitle={"Hoogste bonus — moeilijkste vraag. Beide teams + exacte score (na 90min + eventuele verlengingen).\n\n+15 pt"}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Thuis</label>
            <CountrySelect value={data.final_home_team} onChange={(v) => set("final_home_team", v)} disabled={locked} />
            <input type="number" min={0} max={20} disabled={locked}
              value={data.final_home_score ?? ""}
              onChange={(e) => set("final_home_score", e.target.value === "" ? null : parseInt(e.target.value, 10))}
              placeholder="Score" className="score-input mt-2 w-full" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Uit</label>
            <CountrySelect value={data.final_away_team} onChange={(v) => set("final_away_team", v)} disabled={locked} />
            <input type="number" min={0} max={20} disabled={locked}
              value={data.final_away_score ?? ""}
              onChange={(e) => set("final_away_score", e.target.value === "" ? null : parseInt(e.target.value, 10))}
              placeholder="Score" className="score-input mt-2 w-full" />
          </div>
        </div>
      </BonusCard>

      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-border bg-surface/95 backdrop-blur p-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="text-xs">
            <div className="font-semibold text-foreground">Max bonus: 33 pt</div>
            <div className="text-muted-foreground">{filled} / 4 ingevuld</div>
          </div>
          <Button onClick={save} disabled={busy || locked} className="h-11"><Save className="mr-2 h-4 w-4" />{busy ? "Opslaan…" : "Opslaan"}</Button>
        </div>
      </div>
    </div>
  );
}

function BonusCard({ Icon, color, points, title, subtitle, children }: {
  Icon: any; color: "primary" | "info" | "amber" | "red" | "purple"; points: number;
  title: string; subtitle: string; children: React.ReactNode;
}) {
  const map: Record<string, { ring: string; bg: string; text: string }> = {
    primary: { ring: "border-primary/40", bg: "bg-primary-soft", text: "text-primary" },
    info:    { ring: "border-info/40",    bg: "bg-info/10",      text: "text-info" },
    amber:   { ring: "border-bonus-amber/40", bg: "bg-bonus-amber/10", text: "text-[color:var(--bonus-amber)]" },
    red:     { ring: "border-bonus-red/40",   bg: "bg-bonus-red/10",   text: "text-[color:var(--bonus-red)]" },
    purple:  { ring: "border-bonus-purple/40",bg: "bg-bonus-purple/10",text: "text-[color:var(--bonus-purple)]" },
  };
  const c = map[color];
  return (
    <section className={`rounded-2xl border ${c.ring} bg-surface p-4`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className={`grid h-9 w-9 place-items-center rounded-lg ${c.bg} ${c.text}`}><Icon className="h-4.5 w-4.5" /></span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.bg} ${c.text}`}>+{points} pt</span>
      </div>
      {children}
    </section>
  );
}

function CountrySelect({ value, onChange, disabled }: { value: string | null; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-10"><SelectValue placeholder="Kies een land…" /></SelectTrigger>
      <SelectContent className="max-h-72">
        {ALL_TEAMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
