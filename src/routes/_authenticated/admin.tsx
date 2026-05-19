import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ALL_TEAMS, PHASE_LABELS } from "@/lib/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Lock, Unlock, Save, Calculator, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { triggerSync } from "@/lib/sync.functions";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

function AdminPage() {
  const { profile, loading } = useAuth();
  if (loading) return <Skeleton className="h-96" />;
  if (!profile?.is_admin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Voer uitslagen in, beheer deelnemers en vergrendel wedstrijden.</p>
      </header>
      <Tabs defaultValue="sync" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="sync">API Sync</TabsTrigger>
          <TabsTrigger value="results">Uitslagen</TabsTrigger>
          <TabsTrigger value="bonus">Bonus</TabsTrigger>
          <TabsTrigger value="users">Deelnemers</TabsTrigger>
          <TabsTrigger value="locks">Vergrendelen</TabsTrigger>
        </TabsList>
        <TabsContent value="sync"><SyncTab /></TabsContent>
        <TabsContent value="results"><ResultsTab /></TabsContent>
        <TabsContent value="bonus"><BonusResultsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="locks"><LocksTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ResultsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-matches"],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("*").order("match_number");
      return data ?? [];
    },
  });
  const [values, setValues] = useState<Record<string, { h: string; a: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (isLoading || !data) return <Skeleton className="h-96" />;

  async function saveOne(id: string) {
    const v = values[id]; if (!v || v.h === "" || v.a === "") return toast.error("Vul beide scores in");
    setBusy(id);
    const { error } = await supabase.from("matches").update({
      actual_home_score: parseInt(v.h, 10), actual_away_score: parseInt(v.a, 10), is_locked: true,
    }).eq("id", id);
    if (error) { setBusy(null); return toast.error(error.message); }
    const { error: rpcErr } = await supabase.rpc("calculate_match_points", { _match_id: id });
    setBusy(null);
    if (rpcErr) toast.error(`Opgeslagen maar puntenfout: ${rpcErr.message}`);
    else { toast.success("Opgeslagen & punten berekend"); qc.invalidateQueries({ queryKey: ["admin-matches"] }); }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <ul className="divide-y divide-border max-h-[70vh] overflow-y-auto">
        {data.map(m => {
          const v = values[m.id] ?? { h: m.actual_home_score?.toString() ?? "", a: m.actual_away_score?.toString() ?? "" };
          const hasResult = m.actual_home_score !== null;
          return (
            <li key={m.id} className="flex items-center gap-2 px-3 py-2.5">
              <span className="grid h-6 w-6 place-items-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">{m.match_number}</span>
              <span className="flex-1 truncate text-right text-xs text-foreground">{m.home_team}</span>
              <input type="number" min={0} max={20} value={v.h}
                onChange={(e) => setValues(p => ({ ...p, [m.id]: { ...v, h: e.target.value } }))}
                className="score-input w-12" />
              <span className="text-muted-foreground">–</span>
              <input type="number" min={0} max={20} value={v.a}
                onChange={(e) => setValues(p => ({ ...p, [m.id]: { ...v, a: e.target.value } }))}
                className="score-input w-12" />
              <span className="flex-1 truncate text-left text-xs text-foreground">{m.away_team}</span>
              <Button size="sm" variant={hasResult ? "outline" : "default"} onClick={() => saveOne(m.id)} disabled={busy === m.id}>
                {busy === m.id ? "…" : hasResult ? "Update" : "Opslaan"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BonusResultsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["bonus-results"],
    queryFn: async () => (await supabase.from("bonus_results").select("*").eq("singleton", true).maybeSingle()).data,
  });
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Skeleton className="h-96" />;
  const f = form ?? data ?? {};
  const set = (k: string, v: any) => setForm({ ...(form ?? data), [k]: v });

  async function save() {
    setBusy(true);
    const payload = {
      singleton: true,
      topscorer_country: f.topscorer_country || null,
      clean_sheet_countries: typeof f.clean_sheet_countries === "string" ? f.clean_sheet_countries.split(",").map((s: string) => s.trim()).filter(Boolean) : (f.clean_sheet_countries ?? []),
      early_exit_country: f.early_exit_country || null,
      red_card_final: f.red_card_final ?? null,
      final_home_team: f.final_home_team || null,
      final_away_team: f.final_away_team || null,
      final_home_score: f.final_home_score ?? null,
      final_away_score: f.final_away_score ?? null,
    };
    const { error } = await supabase.from("bonus_results").update(payload).eq("singleton", true);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Bonusresultaten opgeslagen"); qc.invalidateQueries({ queryKey: ["bonus-results"] }); }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <Field label="Topscorer (land)">
        <CountrySel v={f.topscorer_country} onChange={(v) => set("topscorer_country", v)} />
      </Field>
      <Field label="Clean sheets (komma-gescheiden landen, ex aequo)">
        <Input value={Array.isArray(f.clean_sheet_countries) ? f.clean_sheet_countries.join(", ") : (f.clean_sheet_countries ?? "")}
          onChange={(e) => set("clean_sheet_countries", e.target.value)} placeholder="bv. Spanje, Frankrijk" />
      </Field>
      <Field label="Vroege thuisreis (top-10 land of 'geen')">
        <Input value={f.early_exit_country ?? ""} onChange={(e) => set("early_exit_country", e.target.value)} placeholder="Marokko / geen" />
      </Field>
      <Field label="Rode kaart in finale">
        <div className="flex items-center gap-3">
          <Switch checked={!!f.red_card_final} onCheckedChange={(v) => set("red_card_final", v)} />
          <span className="text-sm text-muted-foreground">{f.red_card_final ? "Ja" : "Nee"}</span>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Finale thuisteam"><CountrySel v={f.final_home_team} onChange={(v) => set("final_home_team", v)} /></Field>
        <Field label="Finale uitteam"><CountrySel v={f.final_away_team} onChange={(v) => set("final_away_team", v)} /></Field>
        <Field label="Score thuis"><Input type="number" min={0} max={20} value={f.final_home_score ?? ""} onChange={(e) => set("final_home_score", e.target.value === "" ? null : parseInt(e.target.value, 10))} /></Field>
        <Field label="Score uit"><Input type="number" min={0} max={20} value={f.final_away_score ?? ""} onChange={(e) => set("final_away_score", e.target.value === "" ? null : parseInt(e.target.value, 10))} /></Field>
      </div>
      <Button onClick={save} disabled={busy}><Save className="mr-2 h-4 w-4" />{busy ? "Opslaan…" : "Bonusresultaten opslaan"}</Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
function CountrySel({ v, onChange }: { v: string | null | undefined; onChange: (v: string) => void }) {
  return (
    <Select value={v ?? undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Kies…" /></SelectTrigger>
      <SelectContent className="max-h-72">{ALL_TEAMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("display_name")).data ?? [],
  });
  if (isLoading || !data) return <Skeleton className="h-96" />;
  async function toggle(id: string, val: boolean) {
    const { error } = await supabase.from("profiles").update({ is_admin: val }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Bijgewerkt"); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
  }
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <ul className="divide-y divide-border">
        {data.map(u => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-muted text-xs font-semibold">{u.avatar_initials}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{u.display_name}</div>
              <div className="truncate text-xs text-muted-foreground">{u.email}</div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Admin</span>
              <Switch checked={u.is_admin} onCheckedChange={(v) => toggle(u.id, v)} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LocksTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-locks"],
    queryFn: async () => (await supabase.from("matches").select("id,match_number,home_team,away_team,phase,is_locked").order("match_number")).data ?? [],
  });
  if (isLoading || !data) return <Skeleton className="h-96" />;
  async function toggleLock(id: string, val: boolean) {
    const { error } = await supabase.from("matches").update({ is_locked: val }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["admin-locks"] });
  }
  async function recalc() {
    const { error } = await supabase.rpc("recalculate_all_points");
    if (error) toast.error(error.message); else toast.success("Punten herberekend");
  }
  return (
    <div className="space-y-3">
      <Button onClick={recalc} variant="outline" size="sm"><Calculator className="mr-2 h-4 w-4" />Herbereken alle punten</Button>
      <div className="rounded-2xl border border-border bg-surface">
        <ul className="divide-y divide-border max-h-[70vh] overflow-y-auto">
          {data.map(m => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-8 text-right text-xs text-muted-foreground">#{m.match_number}</span>
              <span className="flex-1 truncate text-foreground">{m.home_team} vs {m.away_team}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{PHASE_LABELS[m.phase]}</span>
              <Button size="sm" variant={m.is_locked ? "default" : "outline"} onClick={() => toggleLock(m.id, !m.is_locked)}>
                {m.is_locked ? <><Lock className="mr-1 h-3 w-3" />Gesloten</> : <><Unlock className="mr-1 h-3 w-3" />Open</>}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
