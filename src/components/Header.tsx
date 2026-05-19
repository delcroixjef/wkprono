import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, Shield } from "lucide-react";

export function Header() {
  const { profile, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <Logo size={34} />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-foreground">WK 2026 Prono</div>
            <div className="text-[11px] text-muted-foreground">WelZeker</div>
          </div>
        </Link>
        {profile && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border bg-surface px-2 py-1.5 text-sm hover:bg-muted">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {profile.avatar_initials}
              </span>
              <span className="pr-1 text-foreground hidden sm:inline">{profile.display_name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{profile.display_name}</DropdownMenuLabel>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground -mt-2">{profile.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {profile.is_admin && (
                <DropdownMenuItem asChild>
                  <Link to="/admin"><Shield className="mr-2 h-4 w-4" />Admin</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="mr-2 h-4 w-4" />Afmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
