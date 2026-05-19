import { cn } from "@/lib/utils";

export function TournamentCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("tournament-surface relative overflow-hidden rounded-2xl p-5 text-white shadow-lg shadow-black/20", className)}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{
        backgroundImage: "linear-gradient(45deg, white 1px, transparent 1px), linear-gradient(-45deg, white 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function WCNumber({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)} style={{ fontFamily: "'Archivo Black', sans-serif" }}>
      {children}
    </span>
  );
}

export function DisplayHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={cn("uppercase tracking-tight", className)} style={{ fontFamily: "'Oswald', sans-serif" }}>
      {children}
    </h1>
  );
}
