import { Link, useRouter } from "@tanstack/react-router";
import { LayoutDashboard, ListChecks, LineChart, Settings, LogOut, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/momentum/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/dashboard", label: "Today",    icon: LayoutDashboard },
  { to: "/habits",    label: "Habits",   icon: ListChecks },
  { to: "/progress",  label: "Progress", icon: LineChart },
  { to: "/settings",  label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-calm">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-border bg-sidebar/80 backdrop-blur px-4 py-6">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 mb-8">
          <span className="grid place-items-center size-9 rounded-xl bg-gradient-hero shadow-glow text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <span className="font-semibold text-lg tracking-tight">Momentum</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              activeProps={{ className: "!bg-sidebar-accent !text-sidebar-accent-foreground font-medium" }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 px-1">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-border bg-background/85 backdrop-blur">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="grid place-items-center size-8 rounded-lg bg-gradient-hero text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="font-semibold tracking-tight">Momentum</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="md:pl-60 pb-24 md:pb-10">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/90 backdrop-blur grid grid-cols-4">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center justify-center py-2 text-xs text-muted-foreground"
            activeProps={{ className: "!text-primary" }}
          >
            <Icon className="size-5 mb-0.5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
