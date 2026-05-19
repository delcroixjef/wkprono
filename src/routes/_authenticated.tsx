import { createFileRoute, Navigate, Outlet, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated")({ component: AuthLayout });

function AuthLayout() {
  const { user, profile, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-background"><div className="h-8 w-8 animate-pulse rounded-full bg-primary/30" /></div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  // Force one-time profile confirmation before showing app
  if (profile && !profile.profile_confirmed && loc.pathname !== "/confirm-profile") {
    return <Navigate to="/confirm-profile" replace />;
  }

  const isConfirm = loc.pathname === "/confirm-profile";
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!isConfirm && <Header />}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 pb-6">
        <Outlet />
      </main>
      {!isConfirm && <BottomNav />}
    </div>
  );
}
