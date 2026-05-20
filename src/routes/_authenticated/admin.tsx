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
import { sendDigestTest, sendDigestNow } from "@/lib/digest.functions";
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="sync">Sync</TabsTrigger>
          <TabsTrigger value="emails">E-mails</TabsTrigger>
          <TabsTrigger value="results">Uitslagen</TabsTrigger>
          <TabsTrigger value="bonus">Bonus</TabsTrigger>
          <TabsTrigger value="users">Deelnemers</TabsTrigger>
          <TabsTrigger value="locks">Vergrendelen</TabsTrigger>
        </TabsList>
        <TabsContent value="sync"><SyncTab /></TabsContent>
        <TabsContent value="emails"><EmailsTab /></TabsContent>
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

function SyncTab() {
  const qc = useQueryClient();
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
      const r = await sync();
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

function EmailsTab() {
  const qc = useQueryClient();
  const test = useServerFn(sendDigestTest);
  const runNow = useServerFn(sendDigestNow);
  const [busy, setBusy] = useState<"test" | "run" | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["digest-log"],
    queryFn: async () => (await supabase.from("email_digest_log").select("*").order("ran_at", { ascending: false }).limit(10)).data ?? [],
    refetchInterval: 15000,
  });
  const last = logs?.[0];
  const lastErr = logs?.find((l) => l.status === "error");

  async function doTest() {
    setBusy("test");
    try {
      const r = await test({ data: {} });
      if (r.status === "ok") toast.success(r.message);
      else if (r.status === "skipped") toast.message(r.message);
      else toast.error(r.message);
      qc.invalidateQueries({ queryKey: ["digest-log"] });
    } catch (e: any) { toast.error(e?.message ?? "Mislukt"); }
    finally { setBusy(null); }
  }
  async function doRun() {
    if (!confirm("Digest nu versturen naar alle deelnemers?")) return;
    setBusy("run");
    try {
      const r = await runNow();
      if (r.status === "ok") toast.success(r.message);
      else if (r.status === "skipped") toast.message(r.message);
      else toast.error(r.message);
      qc.invalidateQueries({ queryKey: ["digest-log"] });
    } catch (e: any) { toast.error(e?.message ?? "Mislukt"); }
    finally { setBusy(null); }
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://wkprono.lovable.app";
  const secretPlaceholder = showSecret ? "EMAIL_DIGEST_SECRET_HIER" : "••••••••";
  const cronUrl = `${baseUrl}/api/public/hooks/send-daily-digest?secret=${secretPlaceholder}`;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {last ? (last.status === "ok"
                ? <CheckCircle2 className="h-5 w-5 text-success" />
                : last.status === "error"
                  ? <AlertCircle className="h-5 w-5 text-destructive" />
                  : <RefreshCw className="h-5 w-5 text-muted-foreground" />)
                : <RefreshCw className="h-5 w-5 text-muted-foreground" />}
              <h2 className="text-base font-semibold text-foreground">Dagelijkse digest</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Verstuurt elke ochtend 08:00 (Brussels) een samenvatting van gisteren naar alle deelnemers.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={doTest} disabled={busy !== null}>
              {busy === "test" ? "Bezig…" : "Testmail naar mezelf"}
            </Button>
            <Button onClick={doRun} disabled={busy !== null}>
              {busy === "run" ? "Bezig…" : "Verstuur nu"}
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Tile label="Laatste run" value={last ? formatDistanceToNow(new Date(last.ran_at), { addSuffix: true }) : "—"} sub={last ? `${last.recipients_count} ontvangers · ${last.matches_count} wedstrijden` : ""} />
          <Tile label="Status" value={last?.status ?? "—"} sub={last?.message ?? ""} tone={last?.status === "error" ? "error" : undefined} />
          <Tile label="Laatste fout" value={lastErr ? formatDistanceToNow(new Date(lastErr.ran_at), { addSuffix: true }) : "—"} sub={lastErr?.message ?? "Geen fouten"} tone={lastErr ? "error" : undefined} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Externe cron-setup</h3>
          <button onClick={() => setShowSecret(s => !s)} className="text-[11px] text-primary hover:underline">
            {showSecret ? "Verberg secret" : "Toon secret-placeholder"}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Maak op <a className="text-primary hover:underline" href="https://cron-job.org" target="_blank" rel="noreferrer">cron-job.org</a> een dagelijkse job aan om 08:00 (Europe/Brussels):
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted px-3 py-2 text-[11px] text-foreground">{cronUrl}</pre>
        <p className="mt-1 text-[11px] text-muted-foreground">Vervang door de EMAIL_DIGEST_SECRET uit Lovable. Mag ook als <code>x-email-digest-secret</code> header. Schedule: <code>0 8 * * *</code> in Brussels-tijdzone.</p>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Laatste 10 digest-runs</div>
        {isLoading ? <Skeleton className="h-40 m-3" /> : (
          <ul className="divide-y divide-border">
            {(logs ?? []).map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <span className={`h-2 w-2 rounded-full ${l.status === "ok" ? "bg-success" : l.status === "error" ? "bg-destructive" : "bg-muted-foreground"}`} />
                <span className="w-32 shrink-0 text-muted-foreground">{new Date(l.ran_at).toLocaleString("nl-BE")}</span>
                <span className="flex-1 truncate text-foreground">{l.message ?? l.status}</span>
                <span className="text-muted-foreground">{l.recipients_count}✉ · {l.matches_count}⚽ · {l.duration_ms}ms</span>
              </li>
            ))}
            {(!logs || logs.length === 0) && (
              <li className="px-4 py-6 text-center text-xs text-muted-foreground">Nog geen digest-runs.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

