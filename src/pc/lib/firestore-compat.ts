/**
 * Firestore compatibility layer, backed by Supabase.
 *
 * Four ported apps (Archiver, Bot Studio, Flipper Zero, TermStudio) were
 * written against Firestore. Momentum runs on Supabase, and adding the
 * Firebase SDK alongside it would mean two auth systems, two sessions and
 * two sets of credentials in one page — so the apps keep their call sites
 * and this module answers them.
 *
 * Documents live in `pc_app_data`: `namespace` is the collection name,
 * `key` is the document id, `value` is the document body. That table is
 * already RLS-scoped to the owner, so these collections are private per
 * user without any rules of their own — the thing Firestore needed a
 * separate rules file for.
 *
 * SCOPE: only the surface those four apps actually use is implemented —
 * collection/doc/addDoc/setDoc/deleteDoc/getDocs/query/where/orderBy/
 * serverTimestamp. `where` and `orderBy` are applied in memory after the
 * namespace is fetched. These collections hold tens of rows (telemetry
 * logs, saved bots), so a filter pushdown into JSONB would add operator
 * complexity to save nothing measurable. If a collection ever grows large,
 * that is the thing to change.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/** Opaque handle. Present so `collection(db, …)` reads like Firestore. */
export const db = { __compat: "supabase" } as const;

export interface CollectionRef {
  __kind: "collection";
  name: string;
}

export interface DocRef {
  __kind: "doc";
  collection: string;
  id: string;
}

type Op = "==" | "!=" | ">" | ">=" | "<" | "<=";

interface WhereConstraint {
  __kind: "where";
  field: string;
  op: Op;
  value: unknown;
}

interface OrderConstraint {
  __kind: "orderBy";
  field: string;
  direction: "asc" | "desc";
}

interface LimitConstraint {
  __kind: "limit";
  count: number;
}

export type QueryConstraint = WhereConstraint | OrderConstraint | LimitConstraint;

export interface QueryRef {
  __kind: "query";
  collection: string;
  constraints: QueryConstraint[];
}

/** Sentinel replaced with the write time, mirroring Firestore's behaviour. */
const SERVER_TIMESTAMP = "__server_timestamp__";

export function serverTimestamp(): string {
  return SERVER_TIMESTAMP;
}

export function collection(_db: unknown, name: string): CollectionRef {
  return { __kind: "collection", name };
}

export function doc(_db: unknown, collectionName: string, id: string): DocRef {
  return { __kind: "doc", collection: collectionName, id };
}

export function where(field: string, op: Op, value: unknown): WhereConstraint {
  return { __kind: "where", field, op, value };
}

export function orderBy(field: string, direction: "asc" | "desc" = "asc"): OrderConstraint {
  return { __kind: "orderBy", field, direction };
}

export function limit(count: number): LimitConstraint {
  return { __kind: "limit", count };
}

export function query(ref: CollectionRef | QueryRef, ...constraints: QueryConstraint[]): QueryRef {
  const base = ref.__kind === "collection" ? { collection: ref.name, constraints: [] } : ref;
  return {
    __kind: "query",
    collection: base.collection,
    constraints: [...base.constraints, ...constraints],
  };
}

/* ── document snapshots ────────────────────────────────────────────────── */

export interface DocSnapshot {
  id: string;
  exists: () => boolean;
  data: () => Record<string, unknown>;
}

export interface QuerySnapshot {
  docs: DocSnapshot[];
  size: number;
  empty: boolean;
  forEach: (fn: (doc: DocSnapshot) => void) => void;
}

function snapshotFor(id: string, value: Record<string, unknown>): DocSnapshot {
  return { id, exists: () => true, data: () => value };
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

/** Replace serverTimestamp() sentinels with the actual write time. */
function materialize(data: Record<string, unknown>): Record<string, unknown> {
  const now = new Date().toISOString();
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) out[k] = v === SERVER_TIMESTAMP ? now : v;
  return out;
}

export async function addDoc(
  ref: CollectionRef,
  data: Record<string, unknown>,
): Promise<{ id: string }> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Not signed in.");
  const id = crypto.randomUUID();
  const { error } = await supabase.from("pc_app_data").insert({
    user_id: userId,
    namespace: ref.name,
    key: id,
    value: materialize(data) as unknown as Json,
  });
  if (error) throw new Error(error.message);
  return { id };
}

export async function setDoc(ref: DocRef, data: Record<string, unknown>): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Not signed in.");
  const { error } = await supabase.from("pc_app_data").upsert(
    {
      user_id: userId,
      namespace: ref.collection,
      key: ref.id,
      value: materialize(data) as unknown as Json,
    },
    { onConflict: "user_id,namespace,key" },
  );
  if (error) throw new Error(error.message);
}

export async function deleteDoc(ref: DocRef): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Not signed in.");
  const { error } = await supabase
    .from("pc_app_data")
    .delete()
    .eq("user_id", userId)
    .eq("namespace", ref.collection)
    .eq("key", ref.id);
  if (error) throw new Error(error.message);
}

export async function getDoc(ref: DocRef): Promise<DocSnapshot> {
  const userId = await currentUserId();
  if (!userId) return { id: ref.id, exists: () => false, data: () => ({}) };
  const { data, error } = await supabase
    .from("pc_app_data")
    .select("key, value")
    .eq("user_id", userId)
    .eq("namespace", ref.collection)
    .eq("key", ref.id)
    .maybeSingle();
  if (error || !data) return { id: ref.id, exists: () => false, data: () => ({}) };
  return snapshotFor(data.key, (data.value ?? {}) as Record<string, unknown>);
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function matches(value: Record<string, unknown>, c: WhereConstraint): boolean {
  const field = value[c.field];
  switch (c.op) {
    case "==":
      return field === c.value;
    case "!=":
      return field !== c.value;
    case ">":
      return compare(field, c.value) > 0;
    case ">=":
      return compare(field, c.value) >= 0;
    case "<":
      return compare(field, c.value) < 0;
    case "<=":
      return compare(field, c.value) <= 0;
    default:
      return true;
  }
}

export async function getDocs(ref: CollectionRef | QueryRef): Promise<QuerySnapshot> {
  const userId = await currentUserId();
  const name = ref.__kind === "collection" ? ref.name : ref.collection;
  const constraints = ref.__kind === "query" ? ref.constraints : [];

  let rows: { key: string; value: unknown }[] = [];
  if (userId) {
    const { data, error } = await supabase
      .from("pc_app_data")
      .select("key, value")
      .eq("user_id", userId)
      .eq("namespace", name);
    if (!error && data) rows = data;
  }

  let docs = rows.map((r) => ({ id: r.key, value: (r.value ?? {}) as Record<string, unknown> }));

  for (const c of constraints) {
    if (c.__kind === "where") docs = docs.filter((d) => matches(d.value, c));
  }
  const order = constraints.find((c): c is OrderConstraint => c.__kind === "orderBy");
  if (order) {
    docs.sort((a, b) => {
      const result = compare(a.value[order.field], b.value[order.field]);
      return order.direction === "desc" ? -result : result;
    });
  }
  const cap = constraints.find((c): c is LimitConstraint => c.__kind === "limit");
  if (cap) docs = docs.slice(0, cap.count);

  const snapshots = docs.map((d) => snapshotFor(d.id, d.value));
  return {
    docs: snapshots,
    size: snapshots.length,
    empty: snapshots.length === 0,
    forEach: (fn) => snapshots.forEach(fn),
  };
}
