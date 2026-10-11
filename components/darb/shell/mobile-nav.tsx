"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n/client";
import { DarbWordmark, SidebarContent } from "./app-sidebar";

/** Under md the sidebar collapses into the top bar: menu button + wordmark; the nav opens in a sheet. */
export function MobileNav() {
  const { t, dir } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={t.nav.openMenu} />}>
          <Menu aria-hidden />
        </SheetTrigger>
        <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-72 gap-0 p-0">
          <div className="flex h-16 shrink-0 items-center px-6">
            <SheetTitle>
              <DarbWordmark />
            </SheetTitle>
          </div>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <DarbWordmark />
    </div>
  );
}
