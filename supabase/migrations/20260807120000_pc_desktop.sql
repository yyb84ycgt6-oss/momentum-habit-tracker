-- ═══════════════════════════════════════════════════════════════════════
-- PC desktop — server-side state
--
-- Jackie's PC kept everything in localStorage: the desktop died with the
-- browser profile and never followed the user to a second device. Here the
-- same state lives in Postgres behind RLS, so the layout, theme, notes and
-- per-app data are the user's account rather than the user's browser.
--
-- Three tables, each owner-scoped:
--   pc_desktop_state  one row per user — the whole shell (layout/theme)
--   pc_app_data       namespaced KV per app — what appStorage() syncs
--   pc_notes          Notepad/Files documents, queryable on their own
-- ═══════════════════════════════════════════════════════════════════════

-- ── The shell: one row per user ────────────────────────────────────────
-- `state` is a single JSONB document (open windows, icon order/visibility,
-- wallpaper, pc mode). It is written as a unit on every layout change, so
-- splitting it into columns would buy nothing but write amplification.
CREATE TABLE public.pc_desktop_state (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme_id TEXT NOT NULL DEFAULT 'cosmic-jackie',
  wallpaper_by_theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Bumped by the client on every write. Lets a second tab/device detect it
  -- is holding a stale document without diffing the whole JSONB blob.
  revision BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pc_desktop_state TO authenticated;
GRANT ALL ON public.pc_desktop_state TO service_role;
ALTER TABLE public.pc_desktop_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own desktop" ON public.pc_desktop_state
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Per-app namespaced KV ──────────────────────────────────────────────
-- The server-side twin of `appStorage(namespace)`. Apps keep writing to
-- localStorage for instant reads; the sync layer mirrors each namespace
-- here so an app's state survives a new device.
CREATE TABLE public.pc_app_data (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, namespace, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pc_app_data TO authenticated;
GRANT ALL ON public.pc_app_data TO service_role;
ALTER TABLE public.pc_app_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own app data" ON public.pc_app_data
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX pc_app_data_ns_idx ON public.pc_app_data(user_id, namespace);

-- ── Documents ──────────────────────────────────────────────────────────
-- Notepad files and anything the Files app shows. A real table rather than
-- a blob inside pc_app_data because these are listed, searched and sorted
-- independently of the app that happens to be open.
CREATE TABLE public.pc_notes (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  body TEXT NOT NULL DEFAULT '',
  -- Free-form so the Files app can group without a schema change.
  folder TEXT NOT NULL DEFAULT 'Documents',
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pc_notes TO authenticated;
GRANT ALL ON public.pc_notes TO service_role;
ALTER TABLE public.pc_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own notes" ON public.pc_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX pc_notes_user_idx ON public.pc_notes(user_id, updated_at DESC);

-- ── updated_at triggers ────────────────────────────────────────────────
-- Reuses public.update_updated_at_column() from the initial migration.
CREATE TRIGGER set_pc_desktop_state_updated BEFORE UPDATE ON public.pc_desktop_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_pc_app_data_updated BEFORE UPDATE ON public.pc_app_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_pc_notes_updated BEFORE UPDATE ON public.pc_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
