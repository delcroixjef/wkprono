import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProgressForNextMatchday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // admin check
    const { data: me } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();
    if (!me?.is_admin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find next match (not yet started)
    const nowIso = new Date().toISOString();
    const { data: nextMatch } = await supabaseAdmin
      .from("matches")
      .select("id, match_date")
      .gt("match_date", nowIso)
      .neq("home_team", "TBD")
      .order("match_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!nextMatch) {
      return { deadline: null, matches: [], participants: [] };
    }

    // All matches on the same Brussels date
    const { data: allMatches } = await supabaseAdmin
      .from("matches")
      .select("id, home_team, away_team, match_date")
      .neq("home_team", "TBD")
      .order("match_date", { ascending: true });

    const tzDate = (iso: string) =>
      new Date(new Date(iso).toLocaleString("en-US", { timeZone: "Europe/Brussels" }))
        .toISOString()
        .slice(0, 10);
    const targetDay = tzDate(nextMatch.match_date);
    const matches = (allMatches ?? []).filter((m) => tzDate(m.match_date) === targetDay);

    const matchIds = matches.map((m) => m.id);
    const firstStart = matches.reduce(
      (acc, m) => (acc < m.match_date ? acc : m.match_date),
      matches[0].match_date,
    );
    const deadline = new Date(new Date(firstStart).getTime() - 30 * 60 * 1000).toISOString();

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_initials, is_locked")
      .eq("profile_confirmed", true)
      .order("display_name");

    const { data: preds } = await supabaseAdmin
      .from("predictions")
      .select("user_id, match_id")
      .in("match_id", matchIds);

    const byUser = new Map<string, Set<string>>();
    for (const p of preds ?? []) {
      const set = byUser.get(p.user_id) ?? new Set<string>();
      set.add(p.match_id);
      byUser.set(p.user_id, set);
    }

    const participants = (profiles ?? []).map((p) => {
      const filled = byUser.get(p.id) ?? new Set<string>();
      return {
        id: p.id,
        display_name: p.display_name,
        avatar_initials: p.avatar_initials,
        is_locked: p.is_locked,
        filled_count: filled.size,
        missing_match_ids: matchIds.filter((id) => !filled.has(id)),
      };
    });

    return { deadline, matches, participants };
  });
