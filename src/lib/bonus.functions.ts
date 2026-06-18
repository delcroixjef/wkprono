import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const bonusPredictionInput = z.object({
  userId: z.string().uuid(),
  topscorer_country: z.string().nullable(),
  clean_sheet_country: z.string().nullable(),
  early_exit_country: z.string().nullable(),
  final_home_team: z.string().nullable(),
  final_away_team: z.string().nullable(),
  final_home_score: z.number().int().min(0).max(20).nullable(),
  final_away_score: z.number().int().min(0).max(20).nullable(),
});

export const saveBonusPrediction = createServerFn({ method: "POST" })
  .inputValidator((data) => bonusPredictionInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profile, error: profileError }, { data: lockRow, error: lockError }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,is_locked").eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("bonus_results").select("bonus_locked").eq("singleton", true).maybeSingle(),
    ]);

    if (profileError) throw new Error(profileError.message);
    if (lockError) throw new Error(lockError.message);
    if (!profile) throw new Error("Deelnemer niet gevonden.");
    if (profile.is_locked) throw new Error("Je account is vergrendeld door een beheerder — bonusvoorspellingen kunnen niet meer worden aangepast.");
    if (lockRow?.bonus_locked) throw new Error("De bonusvragen zijn definitief gesloten door de beheerder.");

    const { data: saved, error } = await supabaseAdmin
      .from("bonus_predictions")
      .upsert(
        {
          user_id: data.userId,
          topscorer_country: data.topscorer_country,
          clean_sheet_country: data.clean_sheet_country,
          early_exit_country: data.early_exit_country,
          final_home_team: data.final_home_team,
          final_away_team: data.final_away_team,
          final_home_score: data.final_home_score,
          final_away_score: data.final_away_score,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return saved;
  });