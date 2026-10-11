import { loadMobileHome } from "@/app/(app)/bills/runs/data";
import { MyActions } from "./_components/my-actions";

/** "My actions": balance + runs and bills waiting for approval. */
export default async function MobileHomePage() {
  const view = await loadMobileHome();
  return <MyActions view={view} />;
}
