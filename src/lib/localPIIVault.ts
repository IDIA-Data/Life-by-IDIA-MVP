// Local PII Vault — IndexedDB-only storage of Connection labels.
// This data NEVER leaves the device. Per the Zero-PII core rule, no first/last
// names ever touch Supabase. Records here are keyed by the anonymous Connection
// UUID and only readable by this device.

const DB_NAME = "idia_local_pii_vault";
const STORE = "connection_labels";
const VERSION = 1;

export interface ConnectionLabel {
  connection_id: string;
  first_name?: string;
  last_name?: string;
  nickname?: string;
  updated_at: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "connection_id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    if (result instanceof Promise) {
      result.then(resolve).catch(reject);
      return;
    }
    result.onsuccess = () => resolve(result.result as T);
    result.onerror = () => reject(result.error);
  });
}

export const localPIIVault = {
  async lookup(connection_id: string): Promise<ConnectionLabel | null> {
    try {
      const out = await withStore<ConnectionLabel | undefined>("readonly", (s) =>
        s.get(connection_id) as IDBRequest<ConnectionLabel | undefined>,
      );
      return out ?? null;
    } catch (e) {
      console.warn("[LOCAL_PII_LOOKUP_FAILED]", e);
      return null;
    }
  },

  async lookupBatch(ids: string[]): Promise<Record<string, ConnectionLabel>> {
    console.log("[LOCAL_PII_MATCH_START]", { count: ids.length });
    const out: Record<string, ConnectionLabel> = {};
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const store = tx.objectStore(STORE);
        ids.forEach((id) => {
          const req = store.get(id);
          req.onsuccess = () => {
            if (req.result) out[id] = req.result as ConnectionLabel;
          };
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn("[LOCAL_PII_MATCH_FAILED]", e);
    }
    console.log("[LOCAL_PII_MATCH_END]", { matched: Object.keys(out).length });
    return out;
  },

  async save(label: Omit<ConnectionLabel, "updated_at">): Promise<void> {
    const record: ConnectionLabel = { ...label, updated_at: Date.now() };
    await withStore("readwrite", (s) => s.put(record));
  },

  async remove(connection_id: string): Promise<void> {
    await withStore("readwrite", (s) => s.delete(connection_id));
  },

  // Display helpers — always prefer the local nickname, then first+last,
  // then a short anonymous handle derived from the UUID.
  displayName(id: string, label: ConnectionLabel | null | undefined): string {
    if (label?.nickname) return label.nickname;
    const full = [label?.first_name, label?.last_name].filter(Boolean).join(" ").trim();
    if (full) return full;
    return `Connection ${id.slice(0, 4).toUpperCase()}`;
  },

  initials(id: string, label: ConnectionLabel | null | undefined): string {
    if (label?.nickname) return label.nickname.slice(0, 2).toUpperCase();
    const f = label?.first_name?.[0];
    const l = label?.last_name?.[0];
    if (f || l) return `${f ?? ""}${l ?? ""}`.toUpperCase();
    return id.slice(0, 2).toUpperCase();
  },
};
