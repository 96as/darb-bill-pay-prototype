"use client";

import { createContext, useContext, type RefObject } from "react";

/**
 * Where overlays (sheets, the invoice viewer) are portalled. The mobile approval view sets it to
 * its phone frame so overlays stay inside the frame on desktop; elsewhere it is unset (document body).
 */
export const PortalContainerContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function usePortalContainer(): RefObject<HTMLElement | null> | undefined {
  return useContext(PortalContainerContext) ?? undefined;
}
