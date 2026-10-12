// Starts an isolated production server for recording (own build dir, own data dir, own port),
// or reuses one that is already answering on BASE.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BASE, DIST_DIR, OUT, PORT, ROOT } from "./config";

async function up(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/demo/state`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function ensureServer(): Promise<{ stop: () => void }> {
  if (await up()) {
    console.log(`• Using the server already running at ${BASE}`);
    return { stop: () => {} };
  }
  const env = { ...process.env, NEXT_DIST_DIR: DIST_DIR, DARB_DATA_DIR: OUT.data };
  fs.mkdirSync(OUT.data, { recursive: true });
  if (!fs.existsSync(path.join(ROOT, DIST_DIR, "BUILD_ID"))) {
    console.log("• Building the app (production) into", DIST_DIR);
    const r = spawnSync("npx", ["next", "build"], { cwd: ROOT, env, stdio: "inherit" });
    if (r.status !== 0) throw new Error("next build failed");
  }
  console.log(`• Starting the recording server on port ${PORT}`);
  const child: ChildProcess = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: ROOT, env, stdio: "ignore" });
  for (let i = 0; i < 120; i++) {
    if (await up()) return { stop: () => child.kill("SIGTERM") };
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill("SIGTERM");
  throw new Error(`The server did not come up on ${BASE}`);
}
