/**
 * Momentum Settings — profile, data and account, as a desktop app.
 *
 * Carries over the `/settings` route. Two corrections came with the move:
 * the notifications switch updated local state but never wrote (only the
 * Save button persisted it, and only alongside the profile fields), and
 * "Delete all data" cleared the tables without refreshing anything on
 * screen, so the habits stayed visible until a manual reload.
 *
 * Desktop appearance (the 26 era themes) lives in System Settings; this app
 * stays scoped to the habit tracker's own account concerns.
 */
import { useEffect, useState } from "react";
import { LogOut, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/momentum/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { bus } from "@/pc/lib/bus";
import { useHabits } from "./useHabits";
import { AppSurface, Section } from "../shared/AppSurface";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  notifications_enabled: boolean;
}

export function MomentumSettingsApp() {
  const { refresh } = useHabits();
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile>({
    display_name: "",
    avatar_url: "",
    notifications_enabled: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, notifications_enabled")
        .eq("id", user.id)
        .maybeSingle();
      if (data) setProfile(data as Profile);
    })();
  }, []);

  async function persist(next: Profile) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "You are signed out." };
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: next.display_name,
      avatar_url: next.avatar_url,
      notifications_enabled: next.notifications_enabled,
    });
    return { ok: !error, error: error?.message };
  }

  async function save() {
    setSaving(true);
    const res = await persist(profile);
    setSaving(false);
    if (res.ok) toast.success("Saved");
    else toast.error(res.error ?? "Could not save");
  }

  /** The switch writes immediately — a toggle that needs a separate Save
   *  reads as broken, and silently discards the change on window close. */
  async function toggleNotifications(enabled: boolean) {
    const next = { ...profile, notifications_enabled: enabled };
    setProfile(next);
    const res = await persist(next);
    if (!res.ok) {
      setProfile(profile);
      toast.error(res.error ?? "Could not save");
    }
  }

  async function exportAll() {
    const [{ data: habits }, { data: logs }] = await Promise.all([
      supabase.from("habits").select("*"),
      supabase.from("habit_logs").select("*"),
    ]);
    const blob = new Blob([JSON.stringify({ habits, logs }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "momentum-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAll() {
    if (!confirm("Delete ALL your habits and logs? This cannot be undone.")) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // Logs first: habit_logs.habit_id is ON DELETE CASCADE, so the reverse
    // order would work too, but this keeps the intent explicit.
    await supabase.from("habit_logs").delete().eq("user_id", user.id);
    await supabase.from("habits").delete().eq("user_id", user.id);
    await refresh();
    bus.emit("habits-changed");
    toast.success("Data cleared");
  }

  async function signOut() {
    await supabase.auth.signOut();
    // The desktop route is auth-gated; tell the shell rather than navigating
    // from inside a window, so it can tear down state first.
    bus.emit("shut-down");
  }

  return (
    <AppSurface>
      <h1 className="text-2xl @2xl:text-3xl font-semibold tracking-tight mb-1">
        Momentum Settings
      </h1>
      <p className="text-muted-foreground mb-8 text-sm">
        Your habit tracker's account and data. Desktop themes live in System Settings.
      </p>

      <div className="space-y-6">
        <Section title="Profile">
          <div className="grid @2xl:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pc-email">Email</Label>
              <Input id="pc-email" value={email} disabled />
            </div>
            <div>
              <Label htmlFor="pc-name">Display name</Label>
              <Input
                id="pc-name"
                value={profile.display_name ?? ""}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </Section>

        <Section title="Light / dark">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium">App theme</div>
              <div className="text-sm text-muted-foreground">
                Follow system, or pick light or dark. Applies to habit windows.
              </div>
            </div>
            <ThemeToggle />
          </div>
        </Section>

        <Section title="Notifications">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium">Gentle daily reminders</div>
              <div className="text-sm text-muted-foreground">
                Saves immediately (delivery coming soon).
              </div>
            </div>
            <Switch checked={profile.notifications_enabled} onCheckedChange={toggleNotifications} />
          </div>
        </Section>

        <Section title="Your data">
          <p className="text-sm text-muted-foreground mb-4">
            Your habits and logs belong to you. Export anytime.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportAll} className="gap-2">
              <Download className="size-4" /> Export JSON
            </Button>
            <Button
              variant="ghost"
              onClick={deleteAll}
              className="gap-2 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4" /> Delete all data
            </Button>
          </div>
        </Section>

        <div className="pt-2">
          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </div>
    </AppSurface>
  );
}

export default MomentumSettingsApp;
