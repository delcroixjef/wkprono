// Server-only: dagelijkse e-mail digest via Lovable Emails queue.
// Bepaalt "gisteren" in Europe/Brussels, verzamelt uitslagen + punten per deelnemer,
// enqueued mail naar de transactional_emails queue en logt elke run.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TZ = "Europe/Brussels";
const APP_URL = "https://wkprono.lovable.app";
const SENDER_DOMAIN = "notify.welzeker.be";
const FROM_ADDRESS = `WelZeker WK Prono <prono@${SENDER_DOMAIN}>`;

function ymdInTZ(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)!.value, 10);
  return { y: get("year"), m: get("month"), day: get("day") };
}

// Brussels offset in minutes for a given UTC instant (handles DST).
function tzOffsetMinutes(d: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(d).map(p => [p.type, p.value]));
  const asUTC = Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day),
    parseInt(parts.hour), parseInt(parts.minute), parseInt(parts.second)
  );
  return Math.round((asUTC - d.getTime()) / 60000);
}

// Yesterday's window in Brussels, returned as UTC ISO strings.
export function yesterdayWindow(now = new Date()): { startISO: string; endISO: string; label: string } {
  const { y, m, day } = ymdInTZ(now);
  // local Brussels midnight today (as if UTC)
  const localMidnightUTC = Date.UTC(y, m - 1, day, 0, 0, 0);
  const offsetNow = tzOffsetMinutes(now);
  // today 00:00 Brussels in real UTC
  const today0 = new Date(localMidnightUTC - offsetNow * 60000);
  const yesterday0 = new Date(today0.getTime() - 24 * 3600 * 1000);
  const label = new Intl.DateTimeFormat("nl-BE", {
    timeZone: TZ, weekday: "long", day: "2-digit", month: "long",
  }).format(yesterday0);
  return { startISO: yesterday0.toISOString(), endISO: today0.toISOString(), label };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function firstName(displayName: string): string {
  return (displayName || "").trim().split(/\s+/)[0] || "daar";
}

type Match = {
  id: string; match_number: number; home_team: string; away_team: string;
  actual_home_score: number; actual_away_score: number; match_date: string;
};
type Profile = { id: string; email: string; display_name: string };
type Prediction = {
  match_id: string; user_id: string;
  predicted_home_score: number; predicted_away_score: number;
  points_earned: number | null; points_breakdown: any;
};
type Standing = { user_id: string; display_name: string; total: number };

async function buildStandings(): Promise<Standing[]> {
  const [{ data: profiles }, { data: preds }, { data: bonus }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, display_name"),
    supabaseAdmin.from("predictions").select("user_id, points_earned"),
    supabaseAdmin.from("bonus_points").select("user_id, points"),
  ]);
  const byUser = new Map<string, number>();
  (preds ?? []).forEach((p: any) => {
    byUser.set(p.user_id, (byUser.get(p.user_id) ?? 0) + (p.points_earned ?? 0));
  });
  (bonus ?? []).forEach((b: any) => {
    byUser.set(b.user_id, (byUser.get(b.user_id) ?? 0) + (b.points ?? 0));
  });
  const list: Standing[] = (profiles ?? []).map((p: any) => ({
    user_id: p.id, display_name: p.display_name || p.email || "?",
    total: byUser.get(p.id) ?? 0,
  }));
  list.sort((a, b) => b.total - a.total || a.display_name.localeCompare(b.display_name));
  return list;
}

function renderEmail(opts: {
  profile: Profile; matches: Match[]; preds: Prediction[];
  standings: Standing[]; label: string;
}): { subject: string; html: string; text: string } {
  const { profile, matches, preds, standings, label } = opts;
  const predByMatch = new Map(preds.map(p => [p.match_id, p]));
  const myStanding = standings.find(s => s.user_id === profile.id);
  const myRank = myStanding ? standings.findIndex(s => s.user_id === profile.id) + 1 : null;
  const above = myRank && myRank > 1 ? standings[myRank - 2] : null;
  const diffAbove = above && myStanding ? above.total - myStanding.total : null;
  const yesterdayPoints = matches.reduce((sum, m) => {
    const p = predByMatch.get(m.id);
    return sum + (p?.points_earned ?? 0);
  }, 0);

  const matchRows = matches.map(m => {
    const p = predByMatch.get(m.id);
    const myPred = p ? `${p.predicted_home_score}–${p.predicted_away_score}` : "—";
    const pts = p?.points_earned ?? 0;
    const bd = p?.points_breakdown ?? {};
    const parts: string[] = [];
    if (bd.exact) parts.push(`${bd.exact} exact`);
    if (bd.outcome) parts.push(`${bd.outcome} W/G/V`);
    if (bd.diff) parts.push(`${bd.diff} verschil`);
    if (bd.near) parts.push(`${bd.near} bijna`);
    const breakdown = parts.length ? ` <span style="color:#888">(${parts.join(" + ")})</span>` : "";
    return `
      <tr>
        <td style="padding:8px 4px;border-bottom:1px solid #eee;">
          <div style="font-weight:600;color:#111">${escapeHtml(m.home_team)} – ${escapeHtml(m.away_team)}</div>
          <div style="color:#555;font-size:13px">Uitslag: <b>${m.actual_home_score}–${m.actual_away_score}</b> · Jouw tip: ${escapeHtml(myPred)}</div>
        </td>
        <td style="padding:8px 4px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">
          <span style="font-weight:700;color:${pts > 0 ? "#0a7" : "#999"}">${pts} pt</span>${breakdown}
        </td>
      </tr>`;
  }).join("");

  const top = standings.slice(0, 15);
  const standingRows = top.map((s, i) => `
    <tr>
      <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;color:#888;width:30px">${i + 1}.</td>
      <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;${s.user_id === profile.id ? "font-weight:700;color:#111" : "color:#222"}">${escapeHtml(s.display_name)}</td>
      <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:right;font-variant-numeric:tabular-nums">${s.total}</td>
    </tr>`).join("");

  const subject = `WelZeker WK Prono · ${label} — jij scoorde ${yesterdayPoints} pt`;
  const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222">
<div style="max-width:560px;margin:0 auto;padding:20px">
  <h1 style="font-size:20px;margin:0 0 4px">Goeiemorgen ${escapeHtml(firstName(profile.display_name))} 👋</h1>
  <p style="margin:0 0 16px;color:#555;font-size:14px">Hier is je WelZeker WK Prono digest van <b>${escapeHtml(label)}</b>.</p>

  <div style="background:#fff;border:1px solid #e6e8eb;border-radius:12px;padding:14px 16px;margin-bottom:14px">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin-bottom:6px">Wedstrijden van gisteren</div>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${matchRows}</table>
    <div style="margin-top:10px;font-size:13px;color:#444">Totaal gisteren: <b>${yesterdayPoints} punten</b></div>
  </div>

  <div style="background:#fff;border:1px solid #e6e8eb;border-radius:12px;padding:14px 16px;margin-bottom:14px">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin-bottom:6px">Jouw stand</div>
    <div style="font-size:15px"><b>${myStanding?.total ?? 0}</b> punten · positie <b>${myRank ?? "?"}</b>${diffAbove !== null ? ` · ${diffAbove} achter op ${escapeHtml(above!.display_name)}` : ""}</div>
  </div>

  <div style="background:#fff;border:1px solid #e6e8eb;border-radius:12px;padding:14px 16px;margin-bottom:14px">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin-bottom:6px">Tussenstand (top ${top.length})</div>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${standingRows}</table>
  </div>

  <div style="text-align:center;margin:20px 0">
    <a href="${APP_URL}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px">Open WelZeker WK Prono →</a>
  </div>

  <p style="text-align:center;color:#888;font-size:12px;margin:18px 0 0">Veel succes vandaag — nog alles mogelijk.</p>
</div>
</body></html>`;

  const text = `WelZeker WK Prono — ${label}\n\nHoi ${firstName(profile.display_name)},\n\nJe scoorde gisteren ${yesterdayPoints} punten.\nStand: ${myStanding?.total ?? 0} pt — positie ${myRank ?? "?"}.\n\n${APP_URL}\n\nVeel succes vandaag — nog alles mogelijk.`;

  return { subject, html, text };
}

async function enqueueOne(opts: { to: string; subject: string; html: string; text: string; runId: string }) {
  const messageId = crypto.randomUUID();
  const payload = {
    run_id: opts.runId,
    to: opts.to,
    from: FROM_ADDRESS,
    sender_domain: SENDER_DOMAIN,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    purpose: "transactional",
    label: "daily_digest",
    idempotency_key: `digest-${opts.runId}-${opts.to}`,
    message_id: messageId,
    queued_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: payload as any,
  });
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: "daily_digest",
    recipient_email: opts.to,
    status: "pending",
  });
}

export type DigestResult = {
  status: "ok" | "skipped" | "error";
  message: string;
  recipients_count: number;
  matches_count: number;
  duration_ms: number;
};

async function logRun(r: DigestResult): Promise<void> {
  await supabaseAdmin.from("email_digest_log").insert({
    status: r.status, recipients_count: r.recipients_count,
    matches_count: r.matches_count, message: r.message, duration_ms: r.duration_ms,
  });
}

export async function runDailyDigest(opts: { onlyTo?: string } = {}): Promise<DigestResult> {
  const t0 = Date.now();
  const runId = crypto.randomUUID();

  const { startISO, endISO, label } = yesterdayWindow();
  const { data: matchesRaw, error: mErr } = await supabaseAdmin
    .from("matches")
    .select("id, match_number, home_team, away_team, actual_home_score, actual_away_score, match_date")
    .gte("match_date", startISO).lt("match_date", endISO)
    .not("actual_home_score", "is", null).not("actual_away_score", "is", null)
    .order("match_date");
  if (mErr) {
    const r: DigestResult = { status: "error", message: `DB matches: ${mErr.message}`, recipients_count: 0, matches_count: 0, duration_ms: Date.now() - t0 };
    await logRun(r); return r;
  }
  const matches = (matchesRaw ?? []) as Match[];

  if (matches.length === 0 && !opts.onlyTo) {
    const r: DigestResult = { status: "skipped", message: `Geen wedstrijden op ${label}; geen mail verstuurd.`, recipients_count: 0, matches_count: 0, duration_ms: Date.now() - t0 };
    await logRun(r); return r;
  }

  const standings = await buildStandings();

  const profilesQuery = supabaseAdmin.from("profiles").select("id, email, display_name").not("email", "is", null);
  const { data: profiles, error: pErr } = opts.onlyTo
    ? await profilesQuery.eq("email", opts.onlyTo)
    : await profilesQuery;
  if (pErr) {
    const r: DigestResult = { status: "error", message: `DB profiles: ${pErr.message}`, recipients_count: 0, matches_count: matches.length, duration_ms: Date.now() - t0 };
    await logRun(r); return r;
  }
  const recipients = (profiles ?? []).filter((p: any) => p.email && /@/.test(p.email)) as Profile[];

  if (recipients.length === 0) {
    const r: DigestResult = { status: "skipped", message: "Geen ontvangers met geldig e-mailadres.", recipients_count: 0, matches_count: matches.length, duration_ms: Date.now() - t0 };
    await logRun(r); return r;
  }

  const matchIds = matches.map(m => m.id);
  const { data: predsRaw } = matchIds.length
    ? await supabaseAdmin.from("predictions")
        .select("match_id, user_id, predicted_home_score, predicted_away_score, points_earned, points_breakdown")
        .in("match_id", matchIds)
    : { data: [] as Prediction[] };
  const predsByUser = new Map<string, Prediction[]>();
  ((predsRaw ?? []) as Prediction[]).forEach(p => {
    const list = predsByUser.get(p.user_id) ?? [];
    list.push(p); predsByUser.set(p.user_id, list);
  });

  let queued = 0; const errors: string[] = [];
  for (const profile of recipients) {
    try {
      const { subject, html, text } = renderEmail({
        profile, matches, standings, label,
        preds: predsByUser.get(profile.id) ?? [],
      });
      await enqueueOne({ to: profile.email, subject, html, text, runId });
      queued++;
    } catch (e: any) {
      errors.push(`${profile.email}: ${e?.message ?? e}`);
    }
  }

  const status: DigestResult["status"] = queued > 0 ? "ok" : "error";
  const message = errors.length
    ? `${queued}/${recipients.length} in wachtrij. Fouten: ${errors.slice(0, 3).join(" | ")}${errors.length > 3 ? ` (+${errors.length - 3} meer)` : ""}`
    : `${queued} mails in wachtrij voor ${matches.length} wedstrijden (${label}).`;
  const r: DigestResult = { status, message, recipients_count: queued, matches_count: matches.length, duration_ms: Date.now() - t0 };
  await logRun(r); return r;
}
