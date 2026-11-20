import { useCallback, useEffect, useState } from "react";
import { getBook } from "../api/books";
import { ApiError } from "../api/client";
import type { Book } from "../types/books";
import { useApp } from "../store";

export function useOwnedBook(id: string) {
  const { navigate } = useApp();
  const [book, setBook] = useState<Book>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    setError(false);
    getBook(id)
      .then((result) => {
        if (active) setBook(result.book);
      })
      .catch((e) => {
        if (!active) return;
        setBook(undefined);
        if (e instanceof ApiError && e.code === "UNAUTHORIZED")
          navigate("/signin?next=" + encodeURIComponent(window.location.pathname + window.location.search));
        else setError(true);
      });
    return () => {
      active = false;
    };
  }, [id, attempt, navigate]);
  return { book, setBook, refresh, error };
}
