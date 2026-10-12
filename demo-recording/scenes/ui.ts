// Locators shared by the scenes (text and roles from lib/i18n/dictionaries/en*.ts).
import type { Page } from "playwright";

export const panel = (page: Page, heading: string | RegExp) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: heading }) }).last();

export const banner = (page: Page, text: string | RegExp) =>
  page.locator('[role="status"], [role="alert"]').filter({ hasText: text }).first();

export const button = (page: Page, name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });

export const link = (page: Page, name: string | RegExp) => page.getByRole("link", { name, exact: typeof name === "string" });

export const dialog = (page: Page) => page.getByRole("dialog").last();

export const toast = (page: Page, text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text }).first();
