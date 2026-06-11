import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function assertAdmin(adminUserId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", adminUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.is_admin) throw new Error("Forbidden");
}

export const triggerSync = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ adminUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await assertAdmin(data.adminUserId);

    const { runSync } = await import("./sync.server");
    return runSync();
  });

export const saveMatchResult = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      adminUserId: z.string().uuid(),
      matchId: z.string().uuid(),
      homeScore: z.number().int().min(0).max(99),
      awayScore: z.number().int().min(0).max(99),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.adminUserId);

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
