/**
 * Notes — documents stored in `pc_notes`, shared by Notepad and Files.
 *
 * PC's Notepad kept its text in a localStorage key per window, so a note was
 * only ever readable by the window that wrote it and vanished with the
 * browser profile. Backing it with a table makes a note an object other apps
 * can act on: Files lists and searches them, the Terminal cats them, and
 * they follow the account to another device.
 */
import { supabase } from "@/integrations/supabase/client";

export interface Note {
  id: string;
  title: string;
  body: string;
  folder: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

async function userId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

export async function listNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("pc_notes")
    .select("*")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data as Note[];
}

export async function getNote(id: string): Promise<Note | null> {
  const { data, error } = await supabase.from("pc_notes").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as Note;
}

export async function createNote(
  input: Partial<Pick<Note, "title" | "body" | "folder">> = {},
): Promise<Note | null> {
  const uid = await userId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("pc_notes")
    .insert({
      user_id: uid,
      title: input.title ?? "Untitled",
      body: input.body ?? "",
      folder: input.folder ?? "Documents",
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as Note;
}

export async function updateNote(
  id: string,
  patch: Partial<Pick<Note, "title" | "body" | "folder" | "pinned">>,
): Promise<boolean> {
  const { error } = await supabase.from("pc_notes").update(patch).eq("id", id);
  return !error;
}

export async function deleteNote(id: string): Promise<boolean> {
  const { error } = await supabase.from("pc_notes").delete().eq("id", id);
  return !error;
}

/** Distinct folder names, for the Files sidebar. */
export function foldersOf(notes: Note[]): string[] {
  return [...new Set(notes.map((n) => n.folder))].sort();
}
