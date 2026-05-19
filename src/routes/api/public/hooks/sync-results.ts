import { createFileRoute } from "@tanstack/react-router";
import { runSync } from "@/lib/sync.server";

export const Route = createFileRoute("/api/public/hooks/sync-results")({
  server: {
    handlers: {
      POST: async () => {
        const result = await runSync();
        return Response.json(result);
      },
      GET: async () => {
        const result = await runSync();
        return Response.json(result);
      },
    },
  },
});
