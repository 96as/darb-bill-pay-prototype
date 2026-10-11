import type { Metadata } from "next";
import { loadMobileShell } from "@/app/(app)/bills/runs/data";
import { MobileShell } from "./_components/mobile-shell";

export const metadata: Metadata = {
  title: "Approvals · Darb",
};

/** Mobile approval view (demo step 5): phone-width column, same tokens and fonts, respects lang/dir. */
export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const shell = await loadMobileShell();
  return (
    <MobileShell users={shell.users} actingUserId={shell.actingUserId}>
      {children}
    </MobileShell>
  );
}
