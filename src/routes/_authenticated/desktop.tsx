/**
 * /desktop — the PC.
 *
 * This route replaces the four habit screens that used to live here
 * (`/dashboard`, `/habits`, `/progress`, `/settings`). They are not gone:
 * each is now an app in the desktop's registry, openable in a window, so
 * Today and Progress can be on screen at the same time instead of being
 * mutually exclusive pages.
 *
 * `ssr: false` is inherited from the `_authenticated` layout, which matters
 * here: the window manager measures the viewport and reads localStorage
 * during its first render, neither of which exists on the server.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { PCThemeProvider } from "@/pc/themes/PCThemeContext";
import { Desktop } from "@/pc/shell/Desktop";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/desktop")({
  head: () => ({ meta: [{ title: "Momentum PC" }] }),
  component: DesktopRoute,
});

function DesktopRoute() {
  const navigate = useNavigate();

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }, [navigate]);

  return (
    <PCThemeProvider>
      <Desktop onSignOut={() => void signOut()} />
    </PCThemeProvider>
  );
}
