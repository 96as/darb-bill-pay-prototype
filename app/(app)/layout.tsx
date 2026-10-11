import { AppHeader } from "@/components/darb/shell/app-header";
import { AppSidebar } from "@/components/darb/shell/app-sidebar";
import { DemoStateProvider } from "@/components/darb/shell/demo-state";
import { ShellTitleProvider } from "@/components/darb/shell/shell-title";
import { loadShellView } from "./data";

/** Darb app shell: white sidebar + main area (secondary background) with a white top header. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const shell = await loadShellView();
  return (
    <DemoStateProvider initial={shell}>
      <ShellTitleProvider>
        <div className="flex min-h-svh bg-background-secondary">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <AppHeader />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      </ShellTitleProvider>
    </DemoStateProvider>
  );
}
