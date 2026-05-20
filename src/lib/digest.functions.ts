import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { runDailyDigest } from "./digest.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

async function resolveAdmin(accessToken: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const sb = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getClaims(accessToken);
  if (error || !data?.claims?.sub) throw new Error("Niet ingelogd");
  const userId = data.claims.sub as string;
  const { data: profile } = await supabaseAdmin.from("profiles").select("is_admin, email").eq("id", userId).maybeSingle();
  if (!profile?.is_admin) throw new Error("Geen admin");
  return profile;
}

export const sendDigestTest = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ accessToken: z.string().min(10), to: z.string().email().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const profile = await resolveAdmin(data.accessToken);
    const to = data.to ?? profile.email;
    return runDailyDigest({ onlyTo: to });
  });

export const sendDigestNow = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ accessToken: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    await resolveAdmin(data.accessToken);
    return runDailyDigest({});
  });
