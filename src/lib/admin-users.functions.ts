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
  .inputValidator((d) =>
    z.object({ adminUserId: z.string().uuid(), locked: z.boolean() }).parse(d),
  )
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
