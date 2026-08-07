/**
 * AppSurface — the frame every Momentum-native app renders into.
 *
 * A window is not a viewport. `md:` breakpoints read the browser width, so a
 * 400px-wide window on a 27" monitor would still lay out as "desktop" and
 * overflow. These wrappers set a container context instead, which is why the
 * apps above use `@md:` / `@2xl:` variants — they respond to the window they
 * are actually in.
 *
 * It also owns the scroll: the window body clips, so each app scrolls its own
 * content rather than the desktop scrolling behind it.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppSurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "@container h-full w-full overflow-y-auto bg-background text-foreground",
        className,
      )}
    >
      <div className="mx-auto max-w-3xl px-5 py-6">{children}</div>
    </div>
  );
}

export function SurfaceHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-2xl @2xl:text-3xl font-semibold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Card section used across the settings-style apps. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="p-5 rounded-2xl bg-card border border-border shadow-soft">
      <h2 className="font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}
