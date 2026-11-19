/** Client-only session cache (no HTTP). The server session lives in an httpOnly cookie. */
import { useSyncExternalStore } from "react";

import type { SessionUser } from "../types/auth";

export type { SessionUser };

let user: SessionUser | null = null;
let revision = 0;
export const getSessionRevision = () => revision;
const listeners = new Set<() => void>();
export const getSessionSnapshot = () => user;

export function setSession(next: SessionUser | null) {
  user = next;
  revision++;
  listeners.forEach((l) => l());
}

export function useSession() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => user,
  );
}
