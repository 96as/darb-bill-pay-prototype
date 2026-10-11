import { loadNewRunView } from "../data";
import { NewRunForm } from "../_components/new-run-form";

/** New payment run (demo step 4; BP-09, BP-10, BP-18). `?bills=a,b` preselects bills. */
export default async function NewPaymentRunPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).bills;
  const preselect = (Array.isArray(raw) ? raw.join(",") : (raw ?? ""))
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const view = await loadNewRunView(preselect);
  return <NewRunForm view={view} />;
}
