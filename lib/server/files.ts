// Where file bytes live. Uploads go to data/files/<id>.<ext>; fixture files are read in place, never copied.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ServiceError } from "./errors";

export interface FileStore {
  /** Saves an upload and returns its project-relative path ("data/files/f_1.pdf"). */
  save(id: string, ext: string, bytes: Uint8Array): Promise<string>;
  /** Reads a project-relative path under data/files/ or fixtures/. */
  read(relPath: string): Promise<Uint8Array>;
}

export const PROJECT_ROOT = process.cwd();
/** Logical prefix of uploaded files in StoredFile.path ("data/files/f_1.pdf"), whatever the data directory. */
export const UPLOAD_DIR = "data/files";

/**
 * Where store.json and uploads live: <project>/data by default; DARB_DATA_DIR overrides it (tests use a temp dir).
 * Read on every call so a test can set it after import.
 */
export function dataDir(): string {
  const env = process.env.DARB_DATA_DIR;
  return env ? path.resolve(PROJECT_ROOT, env) : path.join(PROJECT_ROOT, "data");
}

/**
 * Resolves a stored path: "data/files/…" under the data directory, "fixtures/…" under the project.
 * Anything else, or anything escaping those folders (traversal), is refused.
 */
export function resolveSafe(relPath: string): string {
  const roots = [
    { prefix: `${UPLOAD_DIR}/`, base: path.join(dataDir(), "files") },
    { prefix: "fixtures/", base: path.join(PROJECT_ROOT, "fixtures") },
  ];
  for (const { prefix, base } of roots) {
    if (!relPath.startsWith(prefix)) continue;
    const abs = path.resolve(base, relPath.slice(prefix.length));
    if (abs.startsWith(base + path.sep)) return abs;
  }
  throw new ServiceError("forbidden_path", "File path is outside the file store", 403);
}

const safeName = (id: string, ext: string) => {
  if (!/^[a-z0-9_]+$/i.test(id) || !/^[a-z0-9]+$/i.test(ext)) throw new ServiceError("bad_file_id", "Invalid file id", 400);
  return `${id}.${ext}`;
};

/** Real disk storage, used by the API. */
export const diskFiles: FileStore = {
  async save(id, ext, bytes) {
    const rel = `${UPLOAD_DIR}/${safeName(id, ext)}`;
    await mkdir(path.join(dataDir(), "files"), { recursive: true });
    await writeFile(resolveSafe(rel), bytes);
    return rel;
  },
  async read(relPath) {
    return new Uint8Array(await readFile(resolveSafe(relPath)));
  },
};

/** In-memory storage for tests: uploads stay in a Map, fixtures are read from disk. */
export function memoryFiles(): FileStore & { saved: Map<string, Uint8Array> } {
  const saved = new Map<string, Uint8Array>();
  return {
    saved,
    async save(id, ext, bytes) {
      const rel = `${UPLOAD_DIR}/${safeName(id, ext)}`;
      saved.set(rel, bytes);
      return rel;
    },
    async read(relPath) {
      const hit = saved.get(relPath);
      if (hit) return hit;
      return diskFiles.read(relPath);
    },
  };
}
