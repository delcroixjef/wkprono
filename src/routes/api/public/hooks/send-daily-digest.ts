import { createFileRoute } from "@tanstack/react-router";
import { runDailyDigest } from "@/lib/digest.server";

function checkSecret(request: Request): boolean {
  const expected = process.env.EMAIL_DIGEST_SECRET;
  if (!expected) return false; // verplicht — geen mail zonder secret
  const url = new URL(request.url);
  return url.searchParams.get("secret") === expected
      || request.headers.get("x-email-digest-secret") === expected;
}

async function handle(request: Request) {
  if (!checkSecret(request)) {
    return new Response(JSON.stringify({ status: "error", message: "Invalid digest secret" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  const url = new URL(request.url);
  const onlyTo = url.searchParams.get("to") ?? undefined;
  const result = await runDailyDigest({ onlyTo });
  return Response.json(result);
}

export const Route = createFileRoute("/api/public/hooks/send-daily-digest")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
