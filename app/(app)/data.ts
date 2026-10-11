import type { DemoShellData } from "@/components/darb/shell/demo-state";
import { readStore } from "./store";

/** Everything the app shell (sidebar, header, demo bar) needs. */
export async function loadShellView(): Promise<DemoShellData> {
  const store = await readStore();
  return {
    company: { name: store.company.name, nameAr: store.company.nameAr },
    users: store.users.map(({ id, name, nameAr, title, titleAr, role }) => ({ id, name, nameAr, title, titleAr, role })),
    actingUserId: store.session.userId,
    now: store.clock.now,
  };
}
