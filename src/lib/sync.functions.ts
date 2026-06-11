import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const triggerSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", context.userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!profile?.is_admin) throw new Error("Forbidden");

    const { runSync } = await import("./sync.server");
    return runSync();
  });

export const saveMatchResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      matchId: z.string().uuid(),
      homeScore: z.number().int().min(0).max(99),
      awayScore: z.number().int().min(0).max(99),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", context.userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile?.is_admin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("matches")
      .update({
        actual_home_score: data.homeScore,
        actual_away_score: data.awayScore,
        is_locked: true,
        source: "manual",
      })
      .eq("id", data.matchId);

    if (updateError) throw new Error(updateError.message);

    const { error: recalcError } = await supabaseAdmin.rpc("calculate_match_points", { _match_id: data.matchId });
    if (recalcError) throw new Error(recalcError.message);

    return { ok: true };
  });
