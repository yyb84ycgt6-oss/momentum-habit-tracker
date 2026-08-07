/**
 * Notepad — a note editor backed by `pc_notes`.
 *
 * Autosaves on a debounce rather than behind a Save button: a window the
 * user closes by clicking its X gives no chance to save first, so anything
 * gated behind an explicit action is data waiting to be lost.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Plus, Save, Trash2, Loader2, Check } from "lucide-react";
import { createNote, deleteNote, listNotes, updateNote, type Note } from "@/pc/lib/notes";

type SaveState = "idle" | "saving" | "saved";

const AUTOSAVE_MS = 900;

export function NotepadApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loading, setLoading] = useState(true);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the current title/body came from the user or from loading
  // a note, so selecting a note does not immediately re-save it.
  const dirty = useRef(false);

  const load = useCallback(async () => {
    const rows = await listNotes();
    setNotes(rows);
    setLoading(false);
    return rows;
  }, []);

  useEffect(() => {
    void (async () => {
      const rows = await load();
      if (rows.length > 0) {
        setActiveId(rows[0].id);
        setTitle(rows[0].title);
        setBody(rows[0].body);
      }
    })();
  }, [load]);

  const flush = useCallback(async () => {
    if (!activeId || !dirty.current) return;
    setSaveState("saving");
    const ok = await updateNote(activeId, { title: title.trim() || "Untitled", body });
    dirty.current = false;
    setSaveState(ok ? "saved" : "idle");
    setNotes((prev) =>
      prev.map((n) => (n.id === activeId ? { ...n, title: title.trim() || "Untitled", body } : n)),
    );
    if (ok) setTimeout(() => setSaveState("idle"), 1400);
  }, [activeId, title, body]);

  // Debounced autosave.
  useEffect(() => {
    if (!dirty.current || !activeId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, body, activeId, flush]);

  // A closing window unmounts without warning; get the last edit out first.
  useEffect(() => {
    return () => {
      if (dirty.current && activeId) {
        void updateNote(activeId, { title: title.trim() || "Untitled", body });
      }
    };
  }, [activeId, title, body]);

  async function select(note: Note) {
    await flush();
    setActiveId(note.id);
    setTitle(note.title);
    setBody(note.body);
    dirty.current = false;
  }

  async function newNote() {
    await flush();
    const created = await createNote({ title: "Untitled", body: "" });
    if (!created) return;
    setNotes((prev) => [created, ...prev]);
    setActiveId(created.id);
    setTitle(created.title);
    setBody(created.body);
    dirty.current = false;
  }

  async function removeActive() {
    if (!activeId) return;
    if (!confirm("Delete this note?")) return;
    await deleteNote(activeId);
    const rest = notes.filter((n) => n.id !== activeId);
    setNotes(rest);
    dirty.current = false;
    if (rest.length > 0) {
      setActiveId(rest[0].id);
      setTitle(rest[0].title);
      setBody(rest[0].body);
    } else {
      setActiveId(null);
      setTitle("");
      setBody("");
    }
  }

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-200">
      {/* Note list */}
      <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="p-2 border-b border-zinc-800">
          <button
            onClick={newNote}
            className="w-full flex items-center justify-center gap-1.5 rounded bg-zinc-800 px-2 py-1.5 text-xs hover:bg-zinc-700 transition-colors"
          >
            <Plus size={13} /> New note
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-zinc-600">
              <Loader2 size={14} className="mx-auto animate-spin" />
            </div>
          ) : notes.length === 0 ? (
            <p className="p-4 text-xs text-zinc-600">No notes yet.</p>
          ) : (
            notes.map((n) => (
              <button
                key={n.id}
                onClick={() => select(n)}
                className={`w-full border-b border-zinc-900 px-3 py-2 text-left transition-colors ${
                  n.id === activeId ? "bg-zinc-800" : "hover:bg-zinc-900"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-medium truncate">
                  <FileText size={11} className="shrink-0 text-os-accent" />
                  <span className="truncate">{n.title || "Untitled"}</span>
                </div>
                <div className="mt-0.5 truncate text-[10px] text-zinc-500">
                  {n.body.slice(0, 40) || "Empty"}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Editor */}
      <div className="flex flex-1 flex-col min-w-0">
        {activeId ? (
          <>
            <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
              <input
                value={title}
                onChange={(e) => {
                  dirty.current = true;
                  setTitle(e.target.value);
                }}
                placeholder="Untitled"
                className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none placeholder:text-zinc-600"
              />
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                {saveState === "saving" && (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Saving
                  </>
                )}
                {saveState === "saved" && (
                  <>
                    <Check size={11} className="text-emerald-400" /> Saved
                  </>
                )}
              </span>
              <button
                onClick={() => void flush()}
                title="Save now"
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <Save size={13} />
              </button>
              <button
                onClick={removeActive}
                title="Delete note"
                className="rounded p-1 text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <textarea
              value={body}
              onChange={(e) => {
                dirty.current = true;
                setBody(e.target.value);
              }}
              placeholder="Start writing…"
              spellCheck
              className="flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed outline-none placeholder:text-zinc-700"
            />
            <div className="border-t border-zinc-800 px-3 py-1 text-[10px] text-zinc-500">
              {words} {words === 1 ? "word" : "words"} · {body.length} characters
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-zinc-600">
            <FileText size={28} />
            <p className="text-sm">No note selected</p>
            <button
              onClick={newNote}
              className="mt-1 rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700"
            >
              Create one
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotepadApp;
