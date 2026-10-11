// DATA SWAP POINT for every screen in the app shell.
// Today: the temporary sample store built from the BUILD-NOTES seed.
// Later: replace the line below with the real store service, e.g.
//   export { loadStore as readStore } from "@/lib/server/store";
// readStore() must return StoreData (or a Promise of it); callers always `await` it.
export { getSampleStore as readStore } from "@/lib/ui/sample-data";
