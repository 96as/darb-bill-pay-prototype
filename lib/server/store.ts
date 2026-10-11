// Demo state: one JSON file (data/store.json, gitignored; DARB_DATA_DIR moves it, e.g. to a temp dir in tests).
// Every mutation goes through withStore, which serialises writers with an in-process mutex kept on
// globalThis (survives Next dev reloads).
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoreData } from "@/lib/domain/types";
import { STORE_VERSION, createSeed } from "./seed";
import { dataDir } from "./files";

/** data/store.json, or $DARB_DATA_DIR/store.json (tests). */
export const storeFile = () => path.join(dataDir(), "store.json");

type Global = typeof globalThis & { __darbStoreQueue?: Promise<void> };
const g = globalThis as Global;

async function writeAtomic(data: StoreData): Promise<void> {
  const file = storeFile();
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, file);
}

/** Reads the store; creates it from the seed when missing, unreadable or from an older version. */
export async function loadStore(): Promise<StoreData> {
  try {
    const data = JSON.parse(await readFile(storeFile(), "utf8")) as StoreData;
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

/** Back to the seed (demo "Reset"). Uploaded files are deleted too: ids restart from the seed. */
export async function resetStore(): Promise<StoreData> {
  return withStore(async (store) => {
    await rm(path.join(dataDir(), "files"), { recursive: true, force: true });
    const fresh = createSeed();
    for (const key of Object.keys(store) as (keyof StoreData)[]) delete store[key];
    Object.assign(store, fresh);
    return fresh;
  });
}
