import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runDailyDigest } from "./digest.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireAdmin(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin, email")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.is_admin) throw new Error("Geen admin");
  return profile;
}

export const sendDigestTest = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), to: z.string().email().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const profile = await requireAdmin(data.userId);
    const to = data.to ?? profile.email;
    return runDailyDigest({ onlyTo: to });
  });

export const sendDigestNow = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin(data.userId);
    return runDailyDigest({});
  });
