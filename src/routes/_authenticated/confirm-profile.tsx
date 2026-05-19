import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/confirm-profile")({ component: ConfirmProfile });

function ConfirmProfile() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (profile) setName(profile.display_name || ""); }, [profile]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    const initials = name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??";
    const { error } = await supabase.from("profiles").update({
      display_name: name.trim(), avatar_initials: initials, profile_confirmed: true,
    }).eq("id", profile.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await refreshProfile();
    toast.success(`Welkom, ${name.split(" ")[0]}!`);
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-[80vh] place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-4 text-xl font-semibold">Bevestig je profiel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hoe wil je verschijnen in het klassement?</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dn">Weergavenaam</Label>
            <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </div>
          <Button type="submit" className="w-full h-11" disabled={busy}>{busy ? "Opslaan…" : "Bevestig en ga verder"}</Button>
        </form>
      </div>
    </div>
  );
}
