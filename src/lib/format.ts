const TZ = "Europe/Brussels";

export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("nl-BE", {
    timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

export function formatTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("nl-BE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("nl-BE", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(d);
}

export function timeUntil(iso: string | Date): { ms: number; label: string; urgent: boolean; expired: boolean } {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return { ms, label: "Gesloten", urgent: true, expired: true };
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  let label: string;
  if (days >= 1) label = `${days}d ${hours % 24}u`;
  else if (hours >= 1) label = `${hours}u ${Math.floor((ms % 3_600_000) / 60_000)}m`;
  else label = `${Math.floor(ms / 60_000)}m`;
  return { ms, label, urgent: hours < 24, expired: false };
}

export function greeting(): string {
  const h = new Date().toLocaleString("nl-BE", { timeZone: TZ, hour: "numeric", hour12: false });
  const n = parseInt(h, 10);
  if (n < 6) return "Goedenacht";
  if (n < 12) return "Goedemorgen";
  if (n < 18) return "Goedemiddag";
  return "Goedenavond";
}
