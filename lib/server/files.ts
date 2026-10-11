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
export const UPLOAD_DIR = "data/files";
const READABLE_ROOTS = [UPLOAD_DIR, "fixtures"];

/** Resolves a stored relative path, refusing anything outside data/files/ and fixtures/ (no traversal). */
export function resolveSafe(relPath: string): string {
  const abs = path.resolve(PROJECT_ROOT, relPath);
  const allowed = READABLE_ROOTS.some((root) => abs.startsWith(path.resolve(PROJECT_ROOT, root) + path.sep));
  if (!allowed) throw new ServiceError("forbidden_path", "File path is outside the file store", 403);
  return abs;
}

const safeName = (id: string, ext: string) => {
  if (!/^[a-z0-9_]+$/i.test(id) || !/^[a-z0-9]+$/i.test(ext)) throw new ServiceError("bad_file_id", "Invalid file id", 400);
  return `${id}.${ext}`;
};

/** Real disk storage, used by the API. */
export const diskFiles: FileStore = {
  async save(id, ext, bytes) {
    const rel = `${UPLOAD_DIR}/${safeName(id, ext)}`;
    await mkdir(path.resolve(PROJECT_ROOT, UPLOAD_DIR), { recursive: true });
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
