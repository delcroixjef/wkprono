import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function assertAdmin(adminUserId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", adminUserId)
    .maybeSingle();
  if (!data?.is_admin) throw new Error("Forbidden");
}

export const setParticipantLocked = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ adminUserId: z.string().uuid(), userId: z.string().uuid(), locked: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.adminUserId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_locked: data.locked })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBonusQuestionsLocked = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ adminUserId: z.string().uuid(), locked: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    await assertAdmin(data.adminUserId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("bonus_results")
      .update({ bonus_locked: data.locked })
      .eq("singleton", true)
      .select("bonus_locked")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Bonusinstellingen niet gevonden.");

    return { ok: true, locked: row.bonus_locked };
  });

export const saveBonusResults = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      adminUserId: z.string().uuid(),
      topscorer_country: z.string().nullable(),
      clean_sheet_countries: z.array(z.string()),
      early_exit_country: z.string().nullable(),
      final_home_team: z.string().nullable(),
      final_away_team: z.string().nullable(),
      final_home_score: z.number().int().min(0).max(20).nullable(),
      final_away_score: z.number().int().min(0).max(20).nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.adminUserId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { adminUserId, ...payload } = data;
    const { error } = await supabaseAdmin
      .from("bonus_results")
      .update(payload)
      .eq("singleton", true);
    if (error) throw new Error(error.message);

    // Herbereken bonuspunten voor alle deelnemers op basis van nieuwe officiële antwoorden
    const { data: preds } = await supabaseAdmin.from("bonus_predictions").select("user_id");
    for (const p of preds ?? []) {
      const { data: pts } = await supabaseAdmin.rpc("user_bonus_points", { _uid: p.user_id });
      await supabaseAdmin.from("bonus_points").upsert(
        { user_id: p.user_id, points: pts ?? 0, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    }
    return { ok: true };
  });

export const deleteParticipant = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ adminUserId: z.string().uuid(), userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.adminUserId);
    if (data.userId === data.adminUserId) throw new Error("Je kan jezelf niet verwijderen.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("predictions").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("bonus_predictions").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("bonus_points").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    if (error) throw new Error(error.message);

    try {
      await supabaseAdmin.auth.admin.deleteUser(data.userId);
    } catch (e) {
      console.error("auth deleteUser failed", e);
    }
    return { ok: true };
  });
