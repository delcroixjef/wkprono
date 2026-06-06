import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (!data?.is_admin) throw new Error("Forbidden");
}

export const setParticipantLocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; locked: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_locked: data.locked })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Je kan jezelf niet verwijderen.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("predictions").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("bonus_predictions").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("bonus_points").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    if (error) throw new Error(error.message);

    // also remove from auth.users so they can no longer sign in
    try {
      await supabaseAdmin.auth.admin.deleteUser(data.userId);
    } catch (e) {
      console.error("auth deleteUser failed", e);
    }
    return { ok: true };
  });
