import { Lock, Clock, CheckCircle2, AlertCircle, Bot } from "lucide-react";

type Props = {
  matchDate: string;
  isLocked: boolean;
  hasResult: boolean;
  source?: string;
};

export function MatchStatusBadge({ matchDate, isLocked, hasResult, source }: Props) {
  const ms = new Date(matchDate).getTime() - Date.now();
  const closingSoon = !isLocked && ms > 0 && ms <= 60 * 60 * 1000;

  if (hasResult) {
    if (source === "corrected") {
      return <Pill icon={AlertCircle} className="bg-warning/15 text-[color:var(--warning-foreground)]">Handmatig gecorrigeerd</Pill>;
    }
    if (source === "manual") {
      return <Pill icon={AlertCircle} className="bg-warning/15 text-[color:var(--warning-foreground)]">Handmatig ingevoerd</Pill>;
    }
    return <Pill icon={CheckCircle2} className="bg-success/10 text-success">Auto opgehaald</Pill>;
  }
  if (isLocked) return <Pill icon={Lock} className="bg-muted text-muted-foreground">Gesloten</Pill>;
  if (closingSoon) return <Pill icon={Clock} className="bg-destructive/10 text-destructive">Sluit binnenkort</Pill>;
  return <Pill icon={Bot} className="bg-primary-soft text-primary">Open</Pill>;
}

function Pill({ icon: Icon, className, children }: { icon: any; className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${className}`}>
      <Icon className="h-3 w-3" />{children}
    </span>
  );
}
