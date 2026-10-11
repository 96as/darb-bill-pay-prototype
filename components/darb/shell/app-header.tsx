import { DemoBar } from "./demo-bar";
import { MobileNav } from "./mobile-nav";
import { ShellTitle } from "./shell-title";

/** White top header: page title slot on the start side, demo bar on the end side. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-4 py-3 md:px-6">
      <MobileNav />
      <ShellTitle className="hidden min-w-0 flex-1 xl:block" />
      <DemoBar className="ms-auto xl:shrink-0" />
    </header>
  );
}
