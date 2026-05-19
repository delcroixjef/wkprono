import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, user } = useAuth();
  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-background"><div className="h-8 w-8 animate-pulse rounded-full bg-primary/30" /></div>;
  }
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}
