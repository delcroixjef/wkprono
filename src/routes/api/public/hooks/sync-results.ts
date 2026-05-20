import { createFileRoute } from "@tanstack/react-router";
import { runSync } from "@/lib/sync.server";

function checkSecret(request: Request): boolean {
  const expected = process.env.SYNC_SECRET;
  if (!expected) return true; // unset = ongebonden (fun-app fallback)
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("secret");
  const fromHeader = request.headers.get("x-sync-secret");
  return fromQuery === expected || fromHeader === expected;
}

async function handle(request: Request) {
  if (!checkSecret(request)) {
    return new Response(JSON.stringify({ status: "error", message: "Invalid sync secret" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  const result = await runSync();
  return Response.json(result);
}

export const Route = createFileRoute("/api/public/hooks/sync-results")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});
