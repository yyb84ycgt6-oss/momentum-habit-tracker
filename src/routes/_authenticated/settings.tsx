import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Trash2, Download } from "lucide-react";
import { AppShell } from "@/components/momentum/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/momentum/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Momentum" }] }),
  component: Settings,
});

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  notifications_enabled: boolean;
}

function Settings() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [profile, setProfile] = useState<Profile>({ display_name: "", avatar_url: "", notifications_enabled: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data } = await supabase.from("profiles").select("display_name, avatar_url, notifications_enabled").eq("id", user.id).maybeSingle();
      if (data) setProfile(data as Profile);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      notifications_enabled: profile.notifications_enabled,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  }

  async function exportAll() {
    const [{ data: habits }, { data: logs }] = await Promise.all([
      supabase.from("habits").select("*"),
      supabase.from("habit_logs").select("*"),
    ]);
    const blob = new Blob([JSON.stringify({ habits, logs }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "momentum-export.json"; a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAll() {
    if (!confirm("Delete ALL your habits and logs? This cannot be undone.")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("habit_logs").delete().eq("user_id", user.id);
    await supabase.from("habits").delete().eq("user_id", user.id);
    toast.success("Data cleared");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <AppShell>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-1">Settings</h1>
      <p className="text-muted-foreground mb-8">Make Momentum yours.</p>

      <div className="space-y-6 max-w-2xl">
        <Section title="Profile">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled />
            </div>
            <div>
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={profile.display_name ?? ""}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </Section>

        <Section title="Appearance">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Theme</div>
              <div className="text-sm text-muted-foreground">Follow system, or pick light or dark.</div>
            </div>
            <ThemeToggle />
          </div>
        </Section>

        <Section title="Notifications">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Gentle daily reminders</div>
              <div className="text-sm text-muted-foreground">Save preference (delivery coming soon).</div>
            </div>
            <Switch checked={profile.notifications_enabled}
              onCheckedChange={(v) => { setProfile({ ...profile, notifications_enabled: v }); }} />
          </div>
        </Section>

        <Section title="Your data">
          <p className="text-sm text-muted-foreground mb-4">Your habits and logs belong to you. Export anytime.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportAll} className="gap-2"><Download className="size-4" /> Export JSON</Button>
            <Button variant="ghost" onClick={deleteAll} className="gap-2 text-destructive hover:bg-destructive/10">
              <Trash2 className="size-4" /> Delete all data
            </Button>
          </div>
        </Section>

        <div className="pt-4">
          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p-5 md:p-6 rounded-2xl bg-card border border-border shadow-soft">
      <h2 className="font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}
