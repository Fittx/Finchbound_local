import { useEffect, useState } from "react";

/** Tracks connectivity. `forceOffline` lets previews render the offline state. */
export function useOnline(forceOffline = false) {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online && !forceOffline;
}
