// Cache local (IndexedDB) para thumbs de emojis premium.
// Evita rebaixar documentos (WEBP/WebM/TGS) toda vez que sincroniza.

const DB_NAME = "premium-emoji-cache";
const STORE = "thumbs";
const VERSION = 1;

export type CachedEmoji = {
  custom_emoji_id: string;
  preview_char: string | null;
  thumb_data_url: string | null;
  thumb_mime: string | null;
  cached_at: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB indisponível"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "custom_emoji_id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export async function getCachedEmojis(
  ids: string[],
): Promise<Map<string, CachedEmoji>> {
  const result = new Map<string, CachedEmoji>();
  if (!ids.length) return result;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      let pending = ids.length;
      for (const id of ids) {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) result.set(id, req.result as CachedEmoji);
          if (--pending === 0) resolve();
        };
        req.onerror = () => {
          if (--pending === 0) resolve();
        };
      }
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // sem cache disponível
  }
  return result;
}

export async function putCachedEmojis(
  items: Array<Omit<CachedEmoji, "cached_at">>,
): Promise<void> {
  if (!items.length) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const now = Date.now();
      for (const it of items) {
        store.put({ ...it, cached_at: now });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignora falha de cache
  }
}

export async function clearEmojiCache(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignora
  }
}