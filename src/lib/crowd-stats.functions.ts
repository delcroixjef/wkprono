import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CrowdStat = { type: string; text: string; emoji: string };

export const getCrowdStats = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin.rpc("get_crowd_stats" as never);
  if (error) {
    console.error("get_crowd_stats error", error);
    return { stats: [] as CrowdStat[] };
  }
  const stats = Array.isArray(data) ? (data as CrowdStat[]) : [];
  return { stats };
});
