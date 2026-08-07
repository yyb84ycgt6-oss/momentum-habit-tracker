/**
 * Files — browse, search and organise the documents in `pc_notes`.
 *
 * Opens a note by handing it to Notepad through the bus, so there is one
 * editor rather than a second one embedded here.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, FolderOpen, Loader2, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import {
  createNote,
  deleteNote,
  foldersOf,
  listNotes,
  updateNote,
  type Note,
} from "@/pc/lib/notes";
import { bus } from "@/pc/lib/bus";

export function FilesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<string | "all">("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setNotes(await listNotes());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const folders = useMemo(() => foldersOf(notes), [notes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (folder !== "all" && n.folder !== folder) return false;
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
    });
  }, [notes, folder, query]);

  async function addNote() {
    const created = await createNote({ folder: folder === "all" ? "Documents" : folder });
    if (created) setNotes((prev) => [created, ...prev]);
  }

  async function togglePin(note: Note) {
    const ok = await updateNote(note.id, { pinned: !note.pinned });
    if (ok) void load();
  }

  async function remove(note: Note) {
    if (!confirm(`Delete "${note.title}"?`)) return;
    await deleteNote(note.id);
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
  }

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-200">
      <aside className="w-44 shrink-0 border-r border-zinc-800 p-2">
        <button
          onClick={addNote}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded bg-zinc-800 px-2 py-1.5 text-xs hover:bg-zinc-700"
        >
          <Plus size={12} /> New document
        </button>
        <FolderRow
          active={folder === "all"}
          onClick={() => setFolder("all")}
          label="All documents"
          count={notes.length}
        />
        {folders.map((f) => (
          <FolderRow
            key={f}
            active={folder === f}
            onClick={() => setFolder(f)}
            label={f}
            count={notes.filter((n) => n.folder === f).length}
          />
        ))}
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <div className="border-b border-zinc-800 p-2">
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents…"
              className="w-full rounded border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-2 text-xs outline-none placeholder:text-zinc-600 focus:border-os-accent/60"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 size={16} className="mx-auto animate-spin text-zinc-600" />
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-10 text-zinc-600">
              <FolderOpen size={26} />
              <p className="text-xs">
                {query ? "Nothing matches that search." : "This folder is empty."}
              </p>
            </div>
          ) : (
            visible.map((n) => (
              <div
                key={n.id}
                className="group flex items-center gap-2.5 border-b border-zinc-900 px-3 py-2 hover:bg-zinc-900/60"
              >
                <FileText size={14} className="shrink-0 text-os-accent" />
                <button
                  onClick={() => bus.emit("launch-app", { appId: "notepad" })}
                  className="min-w-0 flex-1 text-left"
                  title="Open in Notepad"
                >
                  <div className="flex items-center gap-1.5">
                    {n.pinned && <Pin size={9} className="shrink-0 text-amber-400" />}
                    <span className="truncate text-xs font-medium">{n.title}</span>
                  </div>
                  <div className="truncate text-[10px] text-zinc-500">
                    {n.folder} · {new Date(n.updated_at).toLocaleDateString()} · {n.body.length}{" "}
                    chars
                  </div>
                </button>
                <button
                  onClick={() => togglePin(n)}
                  title={n.pinned ? "Unpin" : "Pin"}
                  className="rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-300 group-hover:opacity-100"
                >
                  {n.pinned ? <PinOff size={11} /> : <Pin size={11} />}
                </button>
                <button
                  onClick={() => remove(n)}
                  title="Delete"
                  className="rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FolderRow({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`mb-0.5 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors ${
        active ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900"
      }`}
    >
      <FolderOpen size={12} className="shrink-0" />
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[10px] text-zinc-600">{count}</span>
    </button>
  );
}

export default FilesApp;
