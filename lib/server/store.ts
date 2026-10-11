// Demo state: one JSON file (data/store.json, gitignored). Every mutation goes through withStore,
// which serialises writers with an in-process mutex kept on globalThis (survives Next dev reloads).
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoreData } from "@/lib/domain/types";
import { STORE_VERSION, createSeed } from "./seed";
import { PROJECT_ROOT } from "./files";

const DATA_DIR = path.join(PROJECT_ROOT, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

type Global = typeof globalThis & { __darbStoreQueue?: Promise<void> };
const g = globalThis as Global;

async function writeAtomic(data: StoreData): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${STORE_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, STORE_FILE);
}

/** Reads the store; creates it from the seed when missing, unreadable or from an older version. */
export async function loadStore(): Promise<StoreData> {
  try {
    const data = JSON.parse(await readFile(STORE_FILE, "utf8")) as StoreData;
    if (data.version === STORE_VERSION) return data;
  } catch {
    // missing or corrupt: fall through to a fresh seed
  }
  const fresh = createSeed();
  await writeAtomic(fresh);
  return fresh;
}

export async function saveStore(data: StoreData): Promise<void> {
  await writeAtomic(data);
}

/** Runs `fn` on a fresh copy of the store and saves it, one caller at a time. Throwing discards the changes. */
export async function withStore<T>(fn: (store: StoreData) => T | Promise<T>): Promise<T> {
  let release!: () => void;
  const mine = new Promise<void>((resolve) => (release = resolve));
  const previous = g.__darbStoreQueue ?? Promise.resolve();
  g.__darbStoreQueue = previous.then(() => mine);
  await previous;
  try {
    const store = await loadStore();
    const result = await fn(store);
    await saveStore(store);
    return result;
  } finally {
    release();
  }
}

/** Back to the seed (demo "Reset"). Uploaded files in data/files are left in place. */
export async function resetStore(): Promise<StoreData> {
  return withStore((store) => {
    const fresh = createSeed();
    for (const key of Object.keys(store) as (keyof StoreData)[]) delete store[key];
    Object.assign(store, fresh);
    return fresh;
  });
}
