import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runDailyDigest } from "./digest.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function ensureAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("profiles").select("is_admin, email").eq("id", userId).maybeSingle();
  if (!data?.is_admin) throw new Error("Geen admin");
  return data;
}

export const sendDigestTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ to: z.string().email().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const profile = await ensureAdmin(context.userId);
    const to = data.to ?? profile.email;
    return runDailyDigest({ onlyTo: to });
  });

export const sendDigestNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    return runDailyDigest({});
  });
