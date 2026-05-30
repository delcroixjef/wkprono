import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCrowdStats, type CrowdStat } from "@/lib/crowd-stats.functions";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";

const DURATION_MS = 10_000;

function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function CrowdStatsPopup() {
  const fetchStats = useServerFn(getCrowdStats);
  const { data } = useQuery({
    queryKey: ["crowd-stats"],
    queryFn: () => fetchStats(),
    staleTime: 0,
    gcTime: 0,
  });

  const stat: CrowdStat | undefined = useMemo(() => pickRandom(data?.stats ?? []), [data]);
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(DURATION_MS);

  useEffect(() => {
    if (!stat) return;
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
  }, [stat]);

  if (!stat) return null;

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
              Wist je dat…
            </DialogTitle>
          </div>
          <DialogDescription className="text-base leading-snug text-foreground">
            <span className="mr-1 text-xl">{stat.emoji}</span>
            {stat.text}
          </DialogDescription>
        </div>
        <div className="relative h-1.5 w-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-100 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between px-5 py-2 text-[11px] text-muted-foreground">
          <span>Crowd-stat van de groep</span>
          <span className="tabular-nums">{seconds}s</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
