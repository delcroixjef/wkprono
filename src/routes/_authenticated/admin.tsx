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
import { Lock, Unlock, Save, Calculator, RefreshCw, CheckCircle2, AlertCircle, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { triggerSync, saveMatchResult } from "@/lib/sync.functions";
import { getProgressForNextMatchday } from "@/lib/admin-progress.functions";
import { setParticipantLocked, deleteParticipant, setBonusQuestionsLocked } from "@/lib/admin-users.functions";
import { formatDistanceToNow, formatDistanceToNowStrict } from "date-fns";
import { nl } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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
        <TabsList className="flex w-full h-auto justify-start gap-1 overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="sync" className="flex-shrink-0 whitespace-nowrap px-3">Sync</TabsTrigger>
          <TabsTrigger value="progress" className="flex-shrink-0 whitespace-nowrap px-3">Prono-status</TabsTrigger>
          <TabsTrigger value="results" className="flex-shrink-0 whitespace-nowrap px-3">Uitslagen</TabsTrigger>
          <TabsTrigger value="bonus" className="flex-shrink-0 whitespace-nowrap px-3">Bonus</TabsTrigger>
          <TabsTrigger value="users" className="flex-shrink-0 whitespace-nowrap px-3">Deelnemers</TabsTrigger>
          <TabsTrigger value="locks" className="flex-shrink-0 whitespace-nowrap px-3">Vergrendelen</TabsTrigger>
        </TabsList>
        <TabsContent value="sync"><SyncTab /></TabsContent>
        <TabsContent value="progress"><ProgressTab /></TabsContent>
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
  const { profile } = useAuth();
  const saveMatch = useServerFn(saveMatchResult);
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
    try {
      await saveMatch({ data: { adminUserId: profile!.id, matchId: id, homeScore: parseInt(v.h, 10), awayScore: parseInt(v.a, 10) } });
      toast.success("Opgeslagen & punten berekend");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-matches"] }),
        qc.invalidateQueries({ queryKey: ["leaderboard"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        qc.invalidateQueries({ queryKey: ["matches"] }),
        qc.invalidateQueries({ queryKey: ["today-matches"] }),
        qc.invalidateQueries({ queryKey: ["admin-locks"] }),
      ]);
    } catch (e: any) {
      console.error("[admin] saveMatch failed", e);
      toast.error(e?.message ?? "Opslaan mislukt");
    } finally {
      setBusy(null);
    }
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
  const { profile } = useAuth();
  const setBonusLock = useServerFn(setBonusQuestionsLocked);
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
      final_home_team: f.final_home_team || null,
      final_away_team: f.final_away_team || null,
      final_home_score: f.final_home_score ?? null,
      final_away_score: f.final_away_score ?? null,
    };
    const { error } = await supabase.from("bonus_results").update(payload).eq("singleton", true);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Bonusresultaten opgeslagen"); qc.invalidateQueries({ queryKey: ["bonus-results"] }); }
  }

  async function toggleBonusLock() {
    if (!profile?.id) return toast.error("Geen adminprofiel gevonden");
    const next = !f.bonus_locked;
    if (next && !window.confirm("Bonusvragen definitief sluiten? Deelnemers kunnen daarna geen wijzigingen meer doorvoeren.")) return;
    setBusy(true);
    try {
      const result = await setBonusLock({ data: { adminUserId: profile.id, locked: next } });
      toast.success(result.locked ? "Bonusvragen vergrendeld" : "Bonusvragen ontgrendeld");
      setForm({ ...(form ?? data), bonus_locked: result.locked });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["bonus-results"] }),
        qc.invalidateQueries({ queryKey: ["bonus-lock"] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? "Bonusvragen aanpassen mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${f.bonus_locked ? "border-bonus-red/40 bg-bonus-red/10" : "border-border bg-muted/30"}`}>
        <div className="text-xs">
          <div className="font-semibold text-foreground">{f.bonus_locked ? "Bonusvragen zijn vergrendeld" : "Bonusvragen zijn open"}</div>
          <div className="text-muted-foreground">{f.bonus_locked ? "Deelnemers kunnen niets meer wijzigen." : "Vergrendel om de bonusvragen definitief te sluiten."}</div>
        </div>
        <Button size="sm" variant={f.bonus_locked ? "outline" : "destructive"} onClick={toggleBonusLock} disabled={busy}>
          {f.bonus_locked ? "Ontgrendel" : "Vergrendel definitief"}
        </Button>
      </div>
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
  const setLocked = useServerFn(setParticipantLocked);
  const deleteUser = useServerFn(deleteParticipant);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("display_name")).data ?? [],
  });
  if (isLoading || !data) return <Skeleton className="h-96" />;
  async function toggleAdmin(id: string, val: boolean) {
    const { error } = await supabase.from("profiles").update({ is_admin: val }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Bijgewerkt"); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
  }
  const { profile } = useAuth();
  async function toggleLock(id: string, val: boolean) {
    try {
      await setLocked({ data: { adminUserId: profile!.id, userId: id, locked: val } });
      toast.success(val ? "Deelnemer vergrendeld" : "Deelnemer ontgrendeld");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e?.message ?? "Mislukt"); }
  }
  async function removeUser(id: string, name: string) {
    try {
      await deleteUser({ data: { adminUserId: profile!.id, userId: id } });
      toast.success(`${name} verwijderd`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e?.message ?? "Verwijderen mislukt"); }
  }
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <ul className="divide-y divide-border">
        {data.map((u: any) => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-muted text-xs font-semibold">{u.avatar_initials}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{u.display_name}</div>
              <div className="truncate text-xs text-muted-foreground">{u.email}</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Admin</span>
                <Switch checked={u.is_admin} onCheckedChange={(v) => toggleAdmin(u.id, v)} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Lock</span>
                <Switch checked={!!u.is_locked} onCheckedChange={(v) => toggleLock(u.id, v)} />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deelnemer verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      <strong>{u.display_name}</strong> en al hun voorspellingen worden permanent verwijderd. Deze actie kan niet ongedaan worden gemaakt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleer</AlertDialogCancel>
                    <AlertDialogAction onClick={() => removeUser(u.id, u.display_name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Verwijder
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressTab() {
  const { profile } = useAuth();
  const getProgress = useServerFn(getProgressForNextMatchday);
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-progress"],
    queryFn: () => getProgress({ data: { adminUserId: profile!.id } }),
    refetchInterval: 30_000,
    retry: false,
    enabled: !!profile?.id,
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Kon prono-status niet laden: {(error as any)?.message ?? "onbekende fout"}.
        <div className="mt-2 text-xs text-muted-foreground">
          Tip: als je de publieke site bekijkt, publiceer eerst de nieuwste versie zodat de nieuwe server-functie beschikbaar is.
        </div>
      </div>
    );
  }
  if (!data) return <Skeleton className="h-96" />;

  if (!data.matches.length) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
        Geen aankomende wedstrijden gevonden.
      </div>
    );
  }

  const deadline = data.deadline ? new Date(data.deadline) : null;
  const past = deadline && deadline.getTime() <= Date.now();
  const total = data.matches.length;
  const matchById = new Map(data.matches.map((m) => [m.id, m]));

  const participants = showOnlyIncomplete
    ? data.participants.filter((p) => p.filled_count < total)
    : data.participants;

  const sorted = [...participants].sort((a, b) => a.filled_count - b.filled_count);
  const complete = data.participants.filter((p) => p.filled_count === total).length;
  const none = data.participants.filter((p) => p.filled_count === 0).length;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Eerstvolgende speeldag</div>
            <div className="mt-0.5 text-base font-semibold text-foreground">
              {total} wedstrijd{total === 1 ? "" : "en"} ·{" "}
              {new Date(data.matches[0].match_date).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
          {deadline && (
            <div className={`text-sm font-medium ${past ? "text-destructive" : "text-foreground"}`}>
              {past ? "Deadline verstreken" : `Deadline over ${formatDistanceToNowStrict(deadline, { locale: nl })}`}
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <Tile label="Volledig" value={`${complete}/${data.participants.length}`} sub="" />
          <Tile label="Niets" value={String(none)} sub="" />
          <Tile label="Wedstrijden" value={String(total)} sub="" />
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={showOnlyIncomplete} onCheckedChange={setShowOnlyIncomplete} />
          Toon enkel onvolledige
        </label>
      </div>

      <div className="rounded-2xl border border-border bg-surface">
        <ul className="divide-y divide-border">
          {sorted.map((p) => {
            const ratio = total === 0 ? 0 : p.filled_count / total;
            const tone = p.filled_count === total ? "success" : p.filled_count === 0 ? "destructive" : "warning";
            const isOpen = !!expanded[p.id];
            return (
              <li key={p.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => setExpanded((s) => ({ ...s, [p.id]: !s[p.id] }))}
                    className="grid h-6 w-6 place-items-center text-muted-foreground hover:text-foreground"
                    disabled={p.missing_match_ids.length === 0}
                  >
                    {p.missing_match_ids.length > 0 ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
                  </button>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-muted text-xs font-semibold">{p.avatar_initials}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {p.display_name} {p.is_locked && <Lock className="inline h-3 w-3 text-muted-foreground" />}
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${tone === "success" ? "bg-success" : tone === "destructive" ? "bg-destructive" : "bg-warning"}`}
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                    tone === "success" ? "bg-success/15 text-success"
                      : tone === "destructive" ? "bg-destructive/15 text-destructive"
                      : "bg-warning/15 text-warning"
                  }`}>
                    {p.filled_count}/{total}
                  </span>
                </div>
                {isOpen && p.missing_match_ids.length > 0 && (
                  <ul className="space-y-1 border-t border-border bg-background/50 px-14 py-2 text-xs text-muted-foreground">
                    {p.missing_match_ids.map((id) => {
                      const m = matchById.get(id);
                      if (!m) return null;
                      return (
                        <li key={id}>
                          • {m.home_team} – {m.away_team} <span className="text-[10px]">({new Date(m.match_date).toLocaleString("nl-BE", { hour: "2-digit", minute: "2-digit" })})</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
          {sorted.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">Iedereen is volledig in orde 🎉</li>
          )}
        </ul>
      </div>
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

function SyncTab() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const sync = useServerFn(triggerSync);
  const [busy, setBusy] = useState(false);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["sync-log"],
    queryFn: async () => (await supabase.from("sync_log").select("*").order("ran_at", { ascending: false }).limit(10)).data ?? [],
    refetchInterval: 15000,
  });
  const lastOk = logs?.find((l) => l.status === "ok");
  const lastErr = logs?.find((l) => l.status === "error");
  const last = logs?.[0];

  const cronWindows = [{ h: 20, m: 0 }, { h: 22, m: 30 }, { h: 1, m: 0 }, { h: 3, m: 30 }, { h: 6, m: 30 }];
  const nextRun = (() => {
    const now = new Date();
    const list = cronWindows.map(({ h, m }) => {
      const d = new Date(now); d.setHours(h, m, 0, 0);
      if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
      return d;
    }).sort((a, b) => a.getTime() - b.getTime());
    return list[0];
  })();

  async function run() {
    setBusy(true);
    try {
      const r = await sync({ data: { adminUserId: profile!.id } });
      if (r.status === "ok") toast.success(r.message ?? "Sync OK");
      else toast.error(r.message ?? "Sync mislukt");
      qc.invalidateQueries({ queryKey: ["sync-log"] });
      qc.invalidateQueries({ queryKey: ["admin-matches"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Sync mislukt");
    } finally { setBusy(false); }
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://wkprono.lovable.app";
  const cronUrl = `${baseUrl}/api/public/hooks/sync-results?secret=YOUR_SYNC_SECRET`;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {last ? (last.status === "ok"
                ? <CheckCircle2 className="h-5 w-5 text-success" />
                : <AlertCircle className="h-5 w-5 text-destructive" />)
                : <RefreshCw className="h-5 w-5 text-muted-foreground" />}
              <h2 className="text-base font-semibold text-foreground">Automatische sync</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Bron: openfootball/worldcup.json (publiek, geen API-key).</p>
          </div>
          <Button onClick={run} disabled={busy}>
            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            {busy ? "Bezig…" : "Sync nu"}
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Tile label="Laatste succes" value={lastOk ? formatDistanceToNow(new Date(lastOk.ran_at), { addSuffix: true }) : "—"} sub={lastOk ? `${lastOk.matches_updated} uitslagen` : ""} />
          <Tile label="Laatste fout" value={lastErr ? formatDistanceToNow(new Date(lastErr.ran_at), { addSuffix: true }) : "—"} sub={lastErr?.message ?? ""} tone={lastErr ? "error" : undefined} />
          <Tile label="Volgende verwacht" value={nextRun.toLocaleString("nl-BE", { hour: "2-digit", minute: "2-digit", weekday: "short" })} sub="Europe/Brussels" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-foreground">Externe cron-setup</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Stel op <a className="text-primary hover:underline" href="https://cron-job.org" target="_blank" rel="noreferrer">cron-job.org</a> een job in die 5× per dag GET stuurt naar onderstaande URL.
          Tijden (Brussels): 20:00, 22:30, 01:00, 03:30, 06:30.
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted px-3 py-2 text-[11px] text-foreground">{cronUrl}</pre>
        <p className="mt-1 text-[11px] text-muted-foreground">Vervang <code>YOUR_SYNC_SECRET</code> door de SYNC_SECRET-waarde uit Lovable. Mag ook als <code>x-sync-secret</code> header.</p>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Laatste 10 sync events</div>
        {isLoading ? <Skeleton className="h-40 m-3" /> : (
          <ul className="divide-y divide-border">
            {(logs ?? []).map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <span className={`h-2 w-2 rounded-full ${l.status === "ok" ? "bg-success" : l.status === "error" ? "bg-destructive" : "bg-muted-foreground"}`} />
                <span className="w-32 shrink-0 text-muted-foreground">{new Date(l.ran_at).toLocaleString("nl-BE")}</span>
                <span className="flex-1 truncate text-foreground">{l.message ?? l.status}</span>
                <span className="text-muted-foreground">{l.matches_updated}↑ {l.matches_locked}🔒 · {l.duration_ms}ms</span>
              </li>
            ))}
            {(!logs || logs.length === 0) && (
              <li className="px-4 py-6 text-center text-xs text-muted-foreground">Nog geen sync events.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "error" }) {
  return (
    <div className={`rounded-md border p-2.5 ${tone === "error" ? "border-destructive/30 bg-destructive/5" : "border-border bg-background"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}


