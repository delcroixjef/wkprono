import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCrowdStats, type CrowdStat } from "@/lib/crowd-stats.functions";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";

const DURATION_MS = 12_000;

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (copy.length && out.length < n) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

const INTRO_LINES = [
  "Wist je dat…",
  "Hete groepsroddels 🔥",
  "Voer voor aan de toog",
  "De massa heeft gesproken",
  "Tijd om elkaar te jennen",
];

export function CrowdStatsPopup() {
  const fetchStats = useServerFn(getCrowdStats);
  const { data } = useQuery({
    queryKey: ["crowd-stats"],
    queryFn: () => fetchStats(),
    staleTime: 0,
    gcTime: 0,
  });

  const stats: CrowdStat[] = useMemo(() => {
    const all = data?.stats ?? [];
    if (all.length === 0) return [];
    const count = Math.min(all.length, all.length >= 3 ? 3 : 2);
    return pickN(all, count);
  }, [data]);

  const intro = useMemo(() => INTRO_LINES[Math.floor(Math.random() * INTRO_LINES.length)], [stats]);

  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(DURATION_MS);

  useEffect(() => {
    if (stats.length === 0) return;
    setOpen(true);
    setRemaining(DURATION_MS);
    const start = Date.now();
    const interval = setInterval(() => {
      const left = Math.max(0, DURATION_MS - (Date.now() - start));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(interval);
        setOpen(false);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [stats]);

  if (stats.length === 0) return null;

  const pct = (remaining / DURATION_MS) * 100;
  const seconds = Math.ceil(remaining / 1000);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm rounded-2xl border-border bg-surface p-0 overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <DialogTitle className="text-sm font-semibold text-foreground">
              {intro}
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">Crowd-stats van de groep</DialogDescription>
          <ul className="space-y-2.5">
            {stats.map((s, i) => (
              <li
                key={i}
                className="flex gap-2.5 rounded-xl border border-border bg-background/40 px-3 py-2.5"
              >
                <span className="text-lg leading-snug">{s.emoji}</span>
                <span className="text-sm leading-snug text-foreground">{s.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative h-1.5 w-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-100 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between px-5 py-2 text-[11px] text-muted-foreground">
          <span>Crowd-stats van de groep</span>
          <span className="tabular-nums">{seconds}s</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
