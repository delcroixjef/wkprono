export function SectionEyebrow({ children, accent = "purple" }: { children: React.ReactNode; accent?: "purple" | "lime" | "primary" | "gold" }) {
  const dot = {
    purple: "bg-wc-purple",
    lime: "bg-wc-lime",
    primary: "bg-primary",
    gold: "bg-wc-gold",
  }[accent];
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="wc-eyebrow text-muted-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>
        {children}
      </span>
    </div>
  );
}
