// DATA SWAP POINT for every screen in the app shell: the real demo store (data/store.json).
// readStore() returns StoreData; callers always `await` it.
export { loadStore as readStore } from "@/lib/server/store";
