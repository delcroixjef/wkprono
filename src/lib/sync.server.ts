// Server-only sync engine.
// Uses ESPN's public World Cup scoreboard for live/final scores.
// Detects score changes via last_synced_score and respects manual overrides.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ALL_TEAMS, TOP_10_FAVORITES } from "./teams";

const REAL_TEAMS = new Set<string>(ALL_TEAMS);
const LOOSE_KICKOFF_MATCH_WINDOW_MS = 14 * 60 * 60 * 1000;

const SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

const TEAM_MAP: Record<string, string> = {
  "Mexico": "Mexico", "South Africa": "Zuid-Afrika",
  "South Korea": "Rep. Korea", "Korea Republic": "Rep. Korea",
  "Czech Republic": "Tsjechië", "Czechia": "Tsjechië",
  "Canada": "Canada",
  "Bosnia and Herzegovina": "Bosnië/Herzeg.", "Bosnia-Herzegovina": "Bosnië/Herzeg.",
  "Qatar": "Qatar", "Switzerland": "Zwitserland",
  "USA": "USA", "United States": "USA",
  "Paraguay": "Paraguay", "Haiti": "Haïti", "Scotland": "Schotland",
  "Australia": "Australië", "Turkey": "Turkije", "Türkiye": "Turkije",
  "Brazil": "Brazilië", "Morocco": "Marokko",
  "Ivory Coast": "Ivoorkust", "Côte d'Ivoire": "Ivoorkust",
  "Ecuador": "Ecuador", "Germany": "Duitsland",
  "Curacao": "Curacao", "Curaçao": "Curacao",
  "Netherlands": "Nederland", "Japan": "Japan", "Sweden": "Zweden",
  "Tunisia": "Tunesië", "Saudi Arabia": "Saoedi-Arabië",
  "Uruguay": "Uruguay", "Spain": "Spanje",
  "Cape Verde": "Kaapverdië",
  "Iran": "IR Iran", "IR Iran": "IR Iran",
  "New Zealand": "Nieuw-Zeeland", "Belgium": "België",
  "Egypt": "Egypte", "France": "Frankrijk", "Senegal": "Senegal",
  "Iraq": "Irak", "Norway": "Noorwegen",
  "Argentina": "Argentinië", "Algeria": "Algerije",
  "Austria": "Oostenrijk", "Jordan": "Jordanië",
  "Ghana": "Ghana", "Panama": "Panama",
  "England": "Engeland", "Croatia": "Kroatië",
  "Portugal": "Portugal",
  "DR Congo": "DR Congo", "Congo DR": "DR Congo",
  "Uzbekistan": "Oezbekistan", "Colombia": "Colombia",
};

function mapTeam(name?: string | null): string | null {
  if (!name) return null;
  return TEAM_MAP[name.trim()] ?? name.trim();
}

function teamKey(home: string, away: string) {
  return `${home}::${away}`;
}

function isPlaceholderTeam(team: string) {
  return !REAL_TEAMS.has(team);
}

function kickoffMs(value?: string | null) {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

type FeedCompetitor = {
  homeAway?: "home" | "away";
  score?: string;
  team?: { displayName?: string; shortDisplayName?: string; name?: string };
};

type FeedEvent = {
  id?: string;
  name?: string;
  date?: string;
  competitions?: Array<{
    competitors?: FeedCompetitor[];
    status?: { type?: { completed?: boolean; state?: string; description?: string } };
  }>;
  status?: { type?: { completed?: boolean; state?: string; description?: string } };
};

type ScoreboardData = { events?: FeedEvent[] };

type SyncedMatch = {
  externalId: string | null;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  completed: boolean;
  kickoff: string | null;
};

function parseScoreboardEvent(event: FeedEvent): SyncedMatch | null {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home?.team || !away?.team) return null;

  const homeName = mapTeam(home.team.displayName ?? home.team.shortDisplayName ?? home.team.name);
  const awayName = mapTeam(away.team.displayName ?? away.team.shortDisplayName ?? away.team.name);
  if (!homeName || !awayName) return null;

  const homeScore = home.score != null && home.score !== "" ? Number.parseInt(home.score, 10) : null;
  const awayScore = away.score != null && away.score !== "" ? Number.parseInt(away.score, 10) : null;
  const status = competition?.status?.type ?? event.status?.type;

  return {
    externalId: event.id ?? null,
    home: homeName,
    away: awayName,
    homeScore: Number.isFinite(homeScore) ? homeScore : null,
    awayScore: Number.isFinite(awayScore) ? awayScore : null,
    completed: !!status?.completed || status?.state === "post",
    kickoff: event.date ?? null,
  };
}

async function fetchScoreboardForDate(dateKey: string): Promise<SyncedMatch[]> {
  const url = `${SCOREBOARD_URL}?dates=${dateKey}`;
  const res = await fetch(url, { headers: { "user-agent": "wk2026-prono" } });
  if (!res.ok) throw new Error(`Scoreboard fetch faalde: HTTP ${res.status}`);
  const data = (await res.json()) as ScoreboardData;
  return (data.events ?? [])
    .map(parseScoreboardEvent)
    .filter((match): match is SyncedMatch => !!match);
}

export type SyncResult = {
  status: "ok" | "error";
  message?: string;
  matchesUpdated: number;
  matchesLocked: number;
  apiCallsUsed: number;
  durationMs: number;
};

export async function runSync(): Promise<SyncResult> {
  const t0 = Date.now();
  let apiCalls = 0;
  let matchesUpdated = 0;
  let matchesLocked = 0;

  try {
    const { data: dbMatches, error } = await supabaseAdmin
      .from("matches")
      .select("id,match_number,home_team,away_team,match_date,actual_home_score,actual_away_score,is_locked,phase,source,auto_sync_override,last_synced_score");
    if (error) throw error;

    const uniqueDates = [...new Set((dbMatches ?? []).map((m) => {
      const d = new Date(m.match_date);
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(d);
      const y = parts.find((p) => p.type === "year")!.value;
      const mo = parts.find((p) => p.type === "month")!.value;
      const da = parts.find((p) => p.type === "day")!.value;
      return `${y}${mo}${da}`;
    }))];

    const syncedMatches: SyncedMatch[] = [];
    for (const dateKey of uniqueDates) {
      apiCalls++;
      const dayMatches = await fetchScoreboardForDate(dateKey);
      syncedMatches.push(...dayMatches);
    }

    const byTeams = new Map<string, typeof dbMatches[number]>();
    for (const m of dbMatches ?? []) {
      byTeams.set(teamKey(m.home_team, m.away_team), m);
    }

    type DbMatch = NonNullable<typeof dbMatches>[number];

    async function applyKnownTeams(dbMatch: DbMatch, synced: SyncedMatch) {
      if (!REAL_TEAMS.has(synced.home) || !REAL_TEAMS.has(synced.away)) return false;

      const currentKey = teamKey(dbMatch.home_team, dbMatch.away_team);
      const nextKey = teamKey(synced.home, synced.away);
      const existing = byTeams.get(nextKey);
      if (existing && existing.id !== dbMatch.id) return false;

      const shouldUpdateTeams = dbMatch.home_team !== synced.home || dbMatch.away_team !== synced.away;
      if (!shouldUpdateTeams) return false;

      const { error: renameErr } = await supabaseAdmin
        .from("matches")
        .update({ home_team: synced.home, away_team: synced.away })
        .eq("id", dbMatch.id);
      if (renameErr) { console.error("[sync] KO-fill faalde", dbMatch.id, renameErr); return false; }

      byTeams.delete(currentKey);
      dbMatch.home_team = synced.home;
      dbMatch.away_team = synced.away;
      byTeams.set(nextKey, dbMatch);
      matchesUpdated++;
      return true;
    }

    // KO-bracket auto-fill: matches met placeholders (bv. "A1", "W74", "3-ABCDF")
    // krijgen echte teamnamen zodra die in de externe bron bekend zijn.
    // Match-criterium: identieke kickoff-timestamp (UTC-instant uit ESPN feed).
    const syncedByKickoff = new Map<number, SyncedMatch>();
    for (const s of syncedMatches) {
      if (s.kickoff) syncedByKickoff.set(kickoffMs(s.kickoff), s);
    }
    for (const dbMatch of dbMatches ?? []) {
      const homeIsPlaceholder = isPlaceholderTeam(dbMatch.home_team);
      const awayIsPlaceholder = isPlaceholderTeam(dbMatch.away_team);
      if (!homeIsPlaceholder && !awayIsPlaceholder) continue;
      const synced = syncedByKickoff.get(kickoffMs(dbMatch.match_date));
      if (!synced) continue;
      await applyKnownTeams(dbMatch, synced);
    }

    // Sommige officiële KO-starturen in de externe feed wijken af van de vooraf ingegeven
    // placeholderkalender. Als de aftrap niet exact matcht, koppel dan het dichtstbijzijnde
    // nog niet gebruikte externe duel binnen dezelfde speeldag/nacht-venster.
    const placeholderMatches = [...(dbMatches ?? [])]
      .filter((m) => m.phase !== "groepsfase" && (isPlaceholderTeam(m.home_team) || isPlaceholderTeam(m.away_team)))
      .sort((a, b) => kickoffMs(a.match_date) - kickoffMs(b.match_date));

    for (const dbMatch of placeholderMatches) {
      const dbKickoff = kickoffMs(dbMatch.match_date);
      const candidate = syncedMatches
        .filter((s) => s.kickoff && REAL_TEAMS.has(s.home) && REAL_TEAMS.has(s.away))
        .filter((s) => !byTeams.has(teamKey(s.home, s.away)))
        .map((s) => ({ synced: s, distance: Math.abs(kickoffMs(s.kickoff) - dbKickoff) }))
        .filter((x) => x.distance <= LOOSE_KICKOFF_MATCH_WINDOW_MS)
        .sort((a, b) => a.distance - b.distance)[0]?.synced;

      if (candidate) await applyKnownTeams(dbMatch, candidate);
    }

    const nowMs = Date.now();
    const lockBuffer = 30 * 60 * 1000;

    for (const synced of syncedMatches) {
      const dbMatch = byTeams.get(teamKey(synced.home, synced.away)) ?? null;
      if (!dbMatch) continue;

      const isLockedManual = dbMatch.source === "manual" || dbMatch.source === "corrected";
      const canOverwrite = !isLockedManual || dbMatch.auto_sync_override;

      // Update score if changed (or first time) — only when allowed
      if (synced.completed && synced.homeScore !== null && synced.awayScore !== null) {
        const newScore = { h: synced.homeScore, a: synced.awayScore };
        const oldSynced = (dbMatch.last_synced_score as { h: number; a: number } | null) ?? null;
        const externalChanged = !oldSynced || oldSynced.h !== synced.homeScore || oldSynced.a !== synced.awayScore;
        const currentDiffers =
          dbMatch.actual_home_score !== synced.homeScore || dbMatch.actual_away_score !== synced.awayScore;

        if (externalChanged && currentDiffers && canOverwrite) {
          const { error: upErr } = await supabaseAdmin
            .from("matches")
            .update({
              actual_home_score: synced.homeScore,
              actual_away_score: synced.awayScore,
              is_locked: true,
              source: dbMatch.source === "manual" ? "corrected" : "auto",
              last_synced_at: new Date().toISOString(),
              last_synced_score: newScore,
            })
            .eq("id", dbMatch.id);
          if (upErr) { console.error("[sync] update faalde", dbMatch.id, upErr); continue; }
          matchesUpdated++;
          // Trigger handles recalc, but call explicitly to be safe.
          await supabaseAdmin.rpc("calculate_match_points", { _match_id: dbMatch.id });
        } else if (externalChanged && !canOverwrite) {
          // Track external knowledge without overwriting.
          await supabaseAdmin.from("matches")
            .update({ last_synced_score: newScore, last_synced_at: new Date().toISOString() })
            .eq("id", dbMatch.id);
        }
      }

      // Pre-kickoff lock: vergrendel deze individuele wedstrijd 30 min vóór haar eigen aftrap.
      // match_date is een absoluut UTC-instant, dus "kickoff - 30 min" valt automatisch op
      // het juiste tijdstip in Europese/Brusselse tijd (bv. 21:00 BE → deadline 20:30 BE).
      if (!dbMatch.is_locked && !(synced.completed && synced.homeScore !== null && synced.awayScore !== null)) {
        const deadline = new Date(dbMatch.match_date).getTime() - lockBuffer;
        if (nowMs >= deadline) {
          await supabaseAdmin.from("matches").update({ is_locked: true }).eq("id", dbMatch.id);
          matchesLocked++;
        }
      }

    }


    await recomputeBonusStats(syncedMatches);
    await recomputeAllBonusPoints();

    const r: SyncResult = {
      status: "ok",
      message: `${matchesUpdated} uitslagen gesynchroniseerd, ${matchesLocked} vergrendeld.`,
      matchesUpdated, matchesLocked, apiCallsUsed: apiCalls, durationMs: Date.now() - t0,
    };
    await logSync(r); return r;
  } catch (e: any) {
    const r: SyncResult = {
      status: "error", message: e?.message ?? String(e),
      matchesUpdated, matchesLocked, apiCallsUsed: apiCalls, durationMs: Date.now() - t0,
    };
    await logSync(r); return r;
  }
}

async function logSync(r: SyncResult) {
  try {
    await supabaseAdmin.from("sync_log").insert({
      status: r.status,
      message: r.message ?? null,
      matches_updated: r.matchesUpdated,
      matches_locked: r.matchesLocked,
      api_calls_used: r.apiCallsUsed,
      duration_ms: r.durationMs,
    });
    const { data: keep } = await supabaseAdmin
      .from("sync_log").select("id,ran_at").order("ran_at", { ascending: false }).limit(50);
    if (keep && keep.length === 50) {
      const cutoff = keep[keep.length - 1]?.ran_at;
      if (cutoff) await supabaseAdmin.from("sync_log").delete().lt("ran_at", cutoff);
    }
  } catch (e) { console.error("[sync] log faalde", e); }
}

async function recomputeBonusStats(ofMatches: SyncedMatch[]) {
  const goalsByPlayer = new Map<string, { country: string; goals: number }>();
  const cleanSheetByCountry = new Map<string, number>();
  const goalsByCountry = new Map<string, number>();

  for (const of of ofMatches) {
    const home = of.home;
    const away = of.away;
    const ft = of.homeScore !== null && of.awayScore !== null ? [of.homeScore, of.awayScore] : null;
    if (!home || !away || !ft) continue;

    if (ft[1] === 0) cleanSheetByCountry.set(home, (cleanSheetByCountry.get(home) ?? 0) + 1);
    if (ft[0] === 0) cleanSheetByCountry.set(away, (cleanSheetByCountry.get(away) ?? 0) + 1);

    goalsByCountry.set(home, (goalsByCountry.get(home) ?? 0) + ft[0]);
    goalsByCountry.set(away, (goalsByCountry.get(away) ?? 0) + ft[1]);
  }

  let maxGoals = 0;
  for (const v of goalsByPlayer.values()) if (v.goals > maxGoals) maxGoals = v.goals;
  const topscorerCountries = new Set<string>();
  if (maxGoals > 0) for (const v of goalsByPlayer.values()) if (v.goals === maxGoals) topscorerCountries.add(v.country);

  let maxCs = 0;
  for (const n of cleanSheetByCountry.values()) if (n > maxCs) maxCs = n;
  const cleanSheetCountries: string[] = [];
  if (maxCs > 0) for (const [c, n] of cleanSheetByCountry.entries()) if (n === maxCs) cleanSheetCountries.push(c);

  const earlyExit = await computeEarlyExit();

  await supabaseAdmin.from("bonus_tournament_stats").update({
    goals_by_country: Object.fromEntries(goalsByCountry),
    topscorer_countries: Array.from(topscorerCountries),
    clean_sheets_by_country: Object.fromEntries(cleanSheetByCountry),
    clean_sheet_leader_count: maxCs,
    clean_sheet_countries: cleanSheetCountries,
    top10_eliminated_in_groups: earlyExit,
    updated_at: new Date().toISOString(),
  }).eq("singleton", true);
}

async function computeEarlyExit(): Promise<string | null> {
  const { data: groupRows } = await supabaseAdmin
    .from("matches").select("home_team,away_team,actual_home_score,actual_away_score,group_code")
    .eq("phase", "groepsfase");
  if (!groupRows || groupRows.length < 72) return null;
  if (groupRows.some((r) => r.actual_home_score === null)) return null;

  type Row = { team: string; pts: number; gd: number; gf: number };
  const groups = new Map<string, Map<string, Row>>();
  for (const m of groupRows) {
    if (!m.group_code) continue;
    if (!groups.has(m.group_code)) groups.set(m.group_code, new Map());
    const g = groups.get(m.group_code)!;
    const ensure = (t: string) => { if (!g.has(t)) g.set(t, { team: t, pts: 0, gd: 0, gf: 0 }); return g.get(t)!; };
    const h = ensure(m.home_team); const a = ensure(m.away_team);
    h.gf += m.actual_home_score!; a.gf += m.actual_away_score!;
    h.gd += m.actual_home_score! - m.actual_away_score!;
    a.gd += m.actual_away_score! - m.actual_home_score!;
    if (m.actual_home_score! > m.actual_away_score!) h.pts += 3;
    else if (m.actual_home_score! < m.actual_away_score!) a.pts += 3;
    else { h.pts += 1; a.pts += 1; }
  }

  const advanced = new Set<string>();
  const thirds: Row[] = [];
  for (const [, g] of groups) {
    const sorted = [...g.values()].sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
    if (sorted[0]) advanced.add(sorted[0].team);
    if (sorted[1]) advanced.add(sorted[1].team);
    if (sorted[2]) thirds.push(sorted[2]);
  }
  thirds.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
  for (let i = 0; i < Math.min(8, thirds.length); i++) advanced.add(thirds[i].team);

  const eliminated = TOP_10_FAVORITES.filter((t) => !advanced.has(t));
  if (eliminated.length === 0) return "geen";
  return eliminated[0];
}

async function recomputeAllBonusPoints() {
  const [{ data: stats }, { data: preds }, { data: final }] = await Promise.all([
    supabaseAdmin.from("bonus_tournament_stats").select("*").eq("singleton", true).maybeSingle(),
    supabaseAdmin.from("bonus_predictions").select("*"),
    supabaseAdmin.from("matches").select("home_team,away_team,actual_home_score,actual_away_score").eq("match_number", 104).maybeSingle(),
  ]);
  if (!stats || !preds) return;
  const finalPlayed = !!final && final.actual_home_score !== null;

  for (const p of preds) {
    const breakdown: Record<string, number> = { topscorer: 0, clean_sheet: 0, early_exit: 0, final_score: 0 };
    if (p.topscorer_country && stats.topscorer_countries?.includes(p.topscorer_country)) breakdown.topscorer = 5;
    if (p.clean_sheet_country && stats.clean_sheet_countries?.includes(p.clean_sheet_country)) breakdown.clean_sheet = 5;
    if (p.early_exit_country && stats.top10_eliminated_in_groups && p.early_exit_country === stats.top10_eliminated_in_groups) breakdown.early_exit = 8;
    if (finalPlayed && final &&
        p.final_home_team === final.home_team && p.final_away_team === final.away_team &&
        p.final_home_score === final.actual_home_score && p.final_away_score === final.actual_away_score) {
      breakdown.final_score = 15;
    }
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
    await supabaseAdmin.from("bonus_points").upsert({
      user_id: p.user_id, points: total, breakdown,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }
}
