import { Link } from "@tanstack/react-router";
import { Home, ListChecks, Trophy, CalendarDays, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function BottomNav() {
  const { profile } = useAuth();
  const items = [
    { to: "/dashboard" as const, label: "Home", Icon: Home },
    { to: "/prono" as const, label: "Prono", Icon: ListChecks },
    { to: "/wedstrijden" as const, label: "Wedstrijden", Icon: CalendarDays },
    { to: "/klassement" as const, label: "Klassement", Icon: Trophy },
    ...(profile?.is_admin ? [{ to: "/admin" as const, label: "Admin", Icon: Shield }] : []),
  ];

  return (
    <nav className="sticky bottom-0 z-40 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-5xl" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ to, label, Icon }) => (
          <Link key={to} to={to}
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors hover:text-foreground"
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
