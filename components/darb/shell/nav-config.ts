import {
  ArrowLeftRight,
  Blocks,
  Calculator,
  ChartPie,
  CreditCard,
  Gift,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Shapes,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Dict } from "@/lib/i18n";

export interface NavItem {
  key: keyof Dict["nav"];
  icon: LucideIcon;
  /** Only Bills links anywhere; items without href are inert. */
  href?: string;
  isNew?: boolean;
}

/** Darb's sidebar order and wording, with Bills added right after Wallets. */
export const NAV_GROUPS: NavItem[][] = [
  [
    { key: "overview", icon: LayoutDashboard },
    { key: "transactions", icon: ArrowLeftRight },
    { key: "cards", icon: CreditCard },
    { key: "category", icon: Shapes },
    { key: "wallets", icon: Wallet, isNew: true },
    { key: "bills", icon: ReceiptText, href: "/bills", isNew: true },
    { key: "fleet", icon: Truck },
    { key: "spendReports", icon: ChartPie },
  ],
  [
    { key: "accounting", icon: Calculator, isNew: true },
    { key: "integrations", icon: Blocks },
    { key: "rewards", icon: Gift },
  ],
];

/** Pinned to the bottom of the sidebar. */
export const NAV_BOTTOM: NavItem = { key: "settings", icon: Settings };

/** Set to "/darb-logo.png" once that file exists in public/; renders a 24px mark before the wordmark. */
export const DARB_LOGO_SRC: string | null = null;
