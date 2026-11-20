import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { type Book } from "./data";
import { LIMITS } from "./constants";
import { cleanRouteQuery } from "./lib/routing";

export type ScreenState = "default" | "empty" | "loading" | "error";
export type Toast = {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
  action?: { label: string; onClick: () => void };
};

type Route = { path: string[]; query: URLSearchParams; bookContext?: string };

type Ctx = {
  route: Route;
  navigate: (to: string) => void;
  books: Book[];
  updateBook: (id: string, patch: Partial<Book>) => void;
  addBook: (b: Book) => void;
  removeBook: (id: string) => () => void;
  clearAccountBooks: () => void;
  toast: (message: string, opts?: Partial<Omit<Toast, "id" | "message">>) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  screenState: ScreenState;
  setScreenState: (s: ScreenState) => void;
  reduced: boolean;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

const parse = (): Route => {
  const raw = (window.location.pathname + window.location.search).replace(/^\//, "");
  const [p = "", q = ""] = raw.split("?");
  return { path: p.split("/").filter(Boolean), query: cleanRouteQuery(q, import.meta.env.DEV) };
};

export function AppProvider({ children }: { children: ReactNode }) {
  if (window.location.hash.startsWith("#/"))
    window.history.replaceState(null, "", window.location.hash.slice(1));
  const [route, setRoute] = useState(parse);
  const [books, setBooks] = useState<Book[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const initial = parse().query;
  const [screenState, setScreenState] = useState<ScreenState>(
    (initial.get("state") as ScreenState) || "default",
  );
  const [systemReduced, setSystemReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const toastId = useRef(0);

  useEffect(() => {
    const onHash = () => {
      const r = parse();
      setRoute((previous) => ({
        ...r,
        bookContext: previous.query.get("book") ?? previous.path[1] ?? previous.path[0],
      }));
      setScreenState((r.query.get("state") as ScreenState) || "default");
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onHash);
    const onLink = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin || !anchor.getAttribute("href")?.startsWith("/")) return;
      event.preventDefault();
      window.history.pushState(null, "", url.pathname + url.search);
      onHash();
    };
    document.addEventListener("click", onLink);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => setSystemReduced(mq.matches);
    mq.addEventListener("change", onMq);
    return () => {
      window.removeEventListener("popstate", onHash);
      document.removeEventListener("click", onLink);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  const navigate = useCallback((to: string) => {
    window.history.pushState(null, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  const dismissToast = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );
  const toast = useCallback<Ctx["toast"]>(
    (message, opts) => {
      const id = ++toastId.current;
      setToasts((t) => [
        ...t.slice(-2),
        { id, message, tone: opts?.tone ?? "success", action: opts?.action },
      ]);
      window.setTimeout(() => dismissToast(id), opts?.action ? LIMITS.undoMs : 3600);
    },
    [dismissToast],
  );

  const updateBook = useCallback(
    (id: string, patch: Partial<Book>) =>
      setBooks((bs) =>
        bs.map((b) => (b.id === id ? { ...b, ...patch, updated: "Updated just now" } : b)),
      ),
    [],
  );
  const addBook = useCallback((b: Book) => setBooks((bs) => [b, ...bs]), []);
  const removeBook = useCallback((id: string) => {
    let removed: { book: Book; index: number } | null = null;
    setBooks((bs) => {
      const index = bs.findIndex((b) => b.id === id);
      if (index >= 0) removed = { book: bs[index]!, index };
      return bs.filter((b) => b.id !== id);
    });
    return () =>
      setBooks((bs) => {
        if (!removed || bs.some((b) => b.id === id)) return bs;
        const next = [...bs];
        next.splice(removed.index, 0, removed.book);
        return next;
      });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      route,
      navigate,
      books,
      updateBook,
      addBook,
      removeBook,
      clearAccountBooks: () => setBooks([]),
      toast,
      toasts,
      dismissToast,
      screenState,
      setScreenState,
      reduced: systemReduced,
    }),
    [
      route,
      navigate,
      books,
      updateBook,
      addBook,
      removeBook,
      toast,
      toasts,
      dismissToast,
      screenState,
      systemReduced,
    ],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/** Simulated network: resolves after a delay unless a development state is forced. */
export function useSimulatedLoad(ms = 700, key: unknown = null) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const t = window.setTimeout(() => setReady(true), ms);
    return () => window.clearTimeout(t);
  }, [ms, key]);
  return ready;
}
