import { Link } from "@tanstack/react-router";
import { Home, ListChecks, Trophy, GitBranch, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const items = [
  { to: "/dashboard" as const, label: "Home", Icon: Home },
  { to: "/prono" as const, label: "Prono", Icon: ListChecks },
  { to: "/klassement" as const, label: "Klassement", Icon: Trophy },
  { to: "/ko-schema" as const, label: "KO-schema", Icon: GitBranch },
  { to: "/bonus" as const, label: "Bonus", Icon: Star },
];

export function BottomNav() {
  const { user } = useAuth();
  const [bonusFilled, setBonusFilled] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("bonus_predictions").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (!data) { setBonusFilled(0); return; }
      let n = 0;
      if (data.topscorer_country) n++;
      if (data.clean_sheet_country) n++;
      if (data.early_exit_country) n++;
      if (data.final_home_team && data.final_home_score !== null) n++;
      setBonusFilled(n);
    });
  }, [user]);

  const bonusBadge = bonusFilled !== null && bonusFilled < 4 ? 4 - bonusFilled : 0;

  return (
    <nav className="sticky bottom-0 z-40 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-5xl grid-cols-5">
        {items.map(({ to, label, Icon }) => (
          <Link
            key={to} to={to}
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors hover:text-foreground"
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
            {to === "/bonus" && bonusBadge > 0 && (
              <span className="absolute right-[28%] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-bonus-amber px-1 text-[9px] font-semibold text-white">{bonusBadge}</span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
