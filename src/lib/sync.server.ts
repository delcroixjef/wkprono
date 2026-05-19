// Server-only: openfootball sync engine.
// Fetches https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
// and updates matches, locks pre-kickoff games, and recomputes bonus stats + points.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TOP_10_FAVORITES } from "./teams";

const DATA_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

// openfootball (English) → our DB (Dutch with diacritics)
const TEAM_MAP: Record<string, string> = {
  "Mexico": "Mexico",
  "South Africa": "Zuid-Afrika",
  "South Korea": "Rep. Korea",
  "Korea Republic": "Rep. Korea",
  "Czech Republic": "Tsjechië",
  "Czechia": "Tsjechië",
  "Canada": "Canada",
  "Bosnia and Herzegovina": "Bosnië/Herzeg.",
  "Bosnia-Herzegovina": "Bosnië/Herzeg.",
  "Qatar": "Qatar",
  "Switzerland": "Zwitserland",
  "USA": "USA",
  "United States": "USA",
  "Paraguay": "Paraguay",
  "Haiti": "Haïti",
  "Scotland": "Schotland",
  "Australia": "Australië",
  "Turkey": "Turkije",
  "Türkiye": "Turkije",
  "Brazil": "Brazilië",
  "Morocco": "Marokko",
  "Ivory Coast": "Ivoorkust",
  "Côte d'Ivoire": "Ivoorkust",
  "Ecuador": "Ecuador",
  "Germany": "Duitsland",
  "Curacao": "Curacao",
  "Curaçao": "Curacao",
  "Netherlands": "Nederland",
  "Japan": "Japan",
  "Sweden": "Zweden",
  "Tunisia": "Tunesië",
  "Saudi Arabia": "Saoedi-Arabië",
  "Uruguay": "Uruguay",
  "Spain": "Spanje",
  "Cape Verde": "Kaapverdië",
  "Iran": "IR Iran",
  "IR Iran": "IR Iran",
  "New Zealand": "Nieuw-Zeeland",
  "Belgium": "België",
  "Egypt": "Egypte",
  "France": "Frankrijk",
  "Senegal": "Senegal",
  "Iraq": "Irak",
  "Norway": "Noorwegen",
  "Argentina": "Argentinië",
  "Algeria": "Algerije",
  "Austria": "Oostenrijk",
  "Jordan": "Jordanië",
  "Ghana": "Ghana",
  "Panama": "Panama",
  "England": "Engeland",
  "Croatia": "Kroatië",
  "Portugal": "Portugal",
  "DR Congo": "DR Congo",
  "Congo DR": "DR Congo",
  "Uzbekistan": "Oezbekistan",
  "Colombia": "Colombia",
};

function mapTeam(name?: string | null): string | null {
  if (!name) return null;
  return TEAM_MAP[name.trim()] ?? name.trim();
}

type OFGoal = {
  name?: string;
  minute?: number;
  score1?: number;
  score2?: number;
  penalty?: boolean;
  owngoal?: boolean;
};
type OFMatch = {
  num?: number;
  date?: string;
  time?: string;
  group?: string;
  team1?: { name?: string; code?: string } | string;
  team2?: { name?: string; code?: string } | string;
  score?: { ft?: [number, number]; ht?: [number, number]; et?: [number, number]; p?: [number, number] };
  goals1?: OFGoal[];
  goals2?: OFGoal[];
};
type OFData = { matches?: OFMatch[] };

function teamName(t: OFMatch["team1"]): string | undefined {
  return typeof t === "string" ? t : t?.name;
}

export type SyncResult = {
  status: "ok" | "error" | "skipped";
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
    // 1. Fetch openfootball data
    apiCalls++;
    const res = await fetch(DATA_URL, { headers: { "user-agent": "wk2026-prono" } });
    if (!res.ok) {
      const result: SyncResult = {
        status: "error",
        message: `Openfootball fetch failed: HTTP ${res.status}`,
        matchesUpdated: 0,
        matchesLocked: 0,
        apiCallsUsed: apiCalls,
        durationMs: Date.now() - t0,
      };
      await logSync(result);
      return result;
    }
    const data = (await res.json()) as OFData;
    const ofMatches = data.matches ?? [];

    // 2. Load our matches
    const { data: dbMatches, error } = await supabaseAdmin
      .from("matches")
      .select("id,match_number,home_team,away_team,match_date,actual_home_score,actual_away_score,is_locked,phase");
    if (error) throw error;

    const byTeams = new Map<string, typeof dbMatches[number]>();
    for (const m of dbMatches ?? []) {
      byTeams.set(`${m.home_team}::${m.away_team}`, m);
    }

    const nowMs = Date.now();
    const lockBuffer = 30 * 60 * 1000; // 30 min before kickoff

    // 3. Iterate and update
    for (const of of ofMatches) {
      const home = mapTeam(teamName(of.team1));
      const away = mapTeam(teamName(of.team2));
      if (!home || !away) continue;
      const dbMatch = byTeams.get(`${home}::${away}`);
      if (!dbMatch) continue; // unmapped or knockout placeholder

      const ft = of.score?.ft;
      if (ft && (dbMatch.actual_home_score === null || dbMatch.actual_away_score === null)) {
        const { error: upErr } = await supabaseAdmin
          .from("matches")
          .update({
            actual_home_score: ft[0],
            actual_away_score: ft[1],
            is_locked: true,
          })
          .eq("id", dbMatch.id);
        if (upErr) {
          console.error("[sync] match update failed", dbMatch.id, upErr);
          continue;
        }
        matchesUpdated++;
        const { error: rpcErr } = await supabaseAdmin.rpc("calculate_match_points", {
          _match_id: dbMatch.id,
        });
        if (rpcErr) console.error("[sync] calc points failed", dbMatch.id, rpcErr);

        // store match stats (cards rarely present in openfootball, leave 0)
        const goalsHome = (of.goals1 ?? []).map((g) => ({
          player: g.name, minute: g.minute, penalty: !!g.penalty, owngoal: !!g.owngoal,
        }));
        const goalsAway = (of.goals2 ?? []).map((g) => ({
          player: g.name, minute: g.minute, penalty: !!g.penalty, owngoal: !!g.owngoal,
        }));
        await supabaseAdmin.from("match_stats").upsert({
          match_id: dbMatch.id,
          api_fixture_id: of.num ?? null,
          home_yellow_cards: 0,
          away_yellow_cards: 0,
          home_red_cards: 0,
          away_red_cards: 0,
          home_goals_detail: goalsHome,
          away_goals_detail: goalsAway,
          penalties_in_match: !!of.score?.p,
          went_to_extra_time: !!of.score?.et,
        }, { onConflict: "match_id" });
      }

      // pre-kickoff lock
      if (!dbMatch.is_locked && !ft) {
        const kickoff = new Date(dbMatch.match_date).getTime();
        if (kickoff - nowMs <= lockBuffer) {
          await supabaseAdmin.from("matches").update({ is_locked: true }).eq("id", dbMatch.id);
          matchesLocked++;
        }
      }
    }

    // 4. Bonus stats (recompute from all completed matches)
    await recomputeBonusStats(ofMatches);

    // 5. Recompute bonus points for all users
    await recomputeAllBonusPoints();

    const result: SyncResult = {
      status: "ok",
      message: `Synced ${matchesUpdated} results, locked ${matchesLocked} upcoming.`,
      matchesUpdated,
      matchesLocked,
      apiCallsUsed: apiCalls,
      durationMs: Date.now() - t0,
    };
    await logSync(result);
    return result;
  } catch (e: any) {
    const result: SyncResult = {
      status: "error",
      message: e?.message ?? String(e),
      matchesUpdated,
      matchesLocked,
      apiCallsUsed: apiCalls,
      durationMs: Date.now() - t0,
    };
    await logSync(result);
    return result;
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
    // trim to last 50
    const { data: keep } = await supabaseAdmin
      .from("sync_log").select("id").order("ran_at", { ascending: false }).limit(50);
    if (keep && keep.length === 50) {
      const cutoffId = keep[keep.length - 1]?.id;
      if (cutoffId) {
        const { data: cutoffRow } = await supabaseAdmin
          .from("sync_log").select("ran_at").eq("id", cutoffId).maybeSingle();
        if (cutoffRow?.ran_at) {
          await supabaseAdmin.from("sync_log").delete().lt("ran_at", cutoffRow.ran_at);
        }
      }
    }
  } catch (e) { console.error("[sync] log failed", e); }
}

async function recomputeBonusStats(ofMatches: OFMatch[]) {
  // Topscorer per country (max goals by a single player, grouped by player's team)
  const goalsByPlayer = new Map<string, { country: string; goals: number }>();
  // Clean sheets per country
  const cleanSheetByCountry = new Map<string, number>();
  // Goals per country (aggregate for display)
  const goalsByCountry = new Map<string, number>();

  for (const of of ofMatches) {
    const home = mapTeam(teamName(of.team1));
    const away = mapTeam(teamName(of.team2));
    const ft = of.score?.ft;
    if (!home || !away || !ft) continue;

    if (ft[1] === 0) cleanSheetByCountry.set(home, (cleanSheetByCountry.get(home) ?? 0) + 1);
    if (ft[0] === 0) cleanSheetByCountry.set(away, (cleanSheetByCountry.get(away) ?? 0) + 1);

    for (const g of of.goals1 ?? []) {
      if (g.owngoal) {
        goalsByCountry.set(away, (goalsByCountry.get(away) ?? 0) + 1);
        continue;
      }
      goalsByCountry.set(home, (goalsByCountry.get(home) ?? 0) + 1);
      if (!g.name) continue;
      const key = `${home}::${g.name}`;
      const prev = goalsByPlayer.get(key);
      goalsByPlayer.set(key, { country: home, goals: (prev?.goals ?? 0) + 1 });
    }
    for (const g of of.goals2 ?? []) {
      if (g.owngoal) {
        goalsByCountry.set(home, (goalsByCountry.get(home) ?? 0) + 1);
        continue;
      }
      goalsByCountry.set(away, (goalsByCountry.get(away) ?? 0) + 1);
      if (!g.name) continue;
      const key = `${away}::${g.name}`;
      const prev = goalsByPlayer.get(key);
      goalsByPlayer.set(key, { country: away, goals: (prev?.goals ?? 0) + 1 });
    }
  }

  // Topscorer countries (countries of all players tied for most goals)
  let maxGoals = 0;
  for (const v of goalsByPlayer.values()) if (v.goals > maxGoals) maxGoals = v.goals;
  const topscorerCountries = new Set<string>();
  if (maxGoals > 0) {
    for (const v of goalsByPlayer.values()) if (v.goals === maxGoals) topscorerCountries.add(v.country);
  }

  // Clean sheet leaders (tied at the top)
  let maxCs = 0;
  for (const n of cleanSheetByCountry.values()) if (n > maxCs) maxCs = n;
  const cleanSheetCountries: string[] = [];
  if (maxCs > 0) {
    for (const [c, n] of cleanSheetByCountry.entries()) if (n === maxCs) cleanSheetCountries.push(c);
  }

  // Early-exit top-10: only when all 72 group matches have a score
  const earlyExit = await computeEarlyExit(ofMatches);

  // Red card final + final result snapshot: read from matches table
  const { data: final } = await supabaseAdmin
    .from("matches").select("actual_home_score,actual_away_score").eq("match_number", 104).maybeSingle();
  const finalPlayed = !!final && final.actual_home_score !== null;

  await supabaseAdmin.from("bonus_tournament_stats").update({
    goals_by_country: Object.fromEntries(goalsByCountry),
    topscorer_countries: Array.from(topscorerCountries),
    clean_sheets_by_country: Object.fromEntries(cleanSheetByCountry),
    clean_sheet_leader_count: maxCs,
    clean_sheet_countries: cleanSheetCountries,
    top10_eliminated_in_groups: earlyExit,
    // final_had_red_card: left for admin to set manually (openfootball lacks card data)
    updated_at: new Date().toISOString(),
  }).eq("singleton", true);

  return { finalPlayed };
}

async function computeEarlyExit(ofMatches: OFMatch[]): Promise<string | null> {
  // Need all 72 group matches played
  const { data: groupRows } = await supabaseAdmin
    .from("matches").select("home_team,away_team,actual_home_score,actual_away_score,group_code")
    .eq("phase", "groepsfase");
  if (!groupRows || groupRows.length < 72) return null;
  if (groupRows.some((r) => r.actual_home_score === null)) return null;

  // Build standings per group
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

  // Top-2 per group always advance; best 8 of the 12 third-placed teams advance.
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

  // Top-10 favourite that didn't advance
  const eliminated = TOP_10_FAVORITES.filter((t) => !advanced.has(t));
  if (eliminated.length === 0) return "geen";
  return eliminated[0]; // first (most-favoured) eliminated
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
    const breakdown: Record<string, number> = {
      topscorer: 0, clean_sheet: 0, early_exit: 0, final_score: 0,
    };
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
      user_id: p.user_id,
      points: total,
      breakdown,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }
}
