import type { DemoShellData } from "@/components/darb/shell/demo-state";
import { readStore } from "./store";

/** Everything the app shell (sidebar, header, demo bar, alerts bell) needs. */
export async function loadShellView(): Promise<DemoShellData> {
  const store = await readStore();
  const userId = store.session.userId;
  return {
    company: { name: store.company.name, nameAr: store.company.nameAr },
    users: store.users.map(({ id, name, nameAr, title, titleAr, role }) => ({ id, name, nameAr, title, titleAr, role })),
    actingUserId: userId,
    now: store.clock.now,
    alerts: store.alerts
      .filter((a) => a.to === userId)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map(({ id, at, kind, message, messageAr, read }) => ({ id, at, kind, message, messageAr, read })),
  };
}
