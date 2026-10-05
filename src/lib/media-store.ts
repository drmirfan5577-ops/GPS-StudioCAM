import { openDB, type IDBPDatabase } from 'idb';
import type { CapturedMedia } from './gps-utils.ts';

const DB_NAME = 'es-gps-cam';
const DB_VERSION = 1;
const STORE_NAME = 'media';

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_timestamp', 'timestamp');
      }
    },
  });
}

export async function saveMediaItem(item: CapturedMedia): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, item);
}

export async function loadAllMedia(): Promise<CapturedMedia[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE_NAME)) as CapturedMedia[];
  return all.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function deleteMediaItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function clearAllMedia(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

export async function getMediaCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORE_NAME);
}
