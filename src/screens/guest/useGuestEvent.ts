import { useCallback, useEffect, useState } from "react";
import { getEvent, type GuestEvent } from "../../api/guest";
import type { Simulate } from "../../api/client";

type State = { status: "loading" | "ready" | "not-found" | "error"; event?: GuestEvent };

export function useGuestEvent(slug: string, simulate?: Simulate) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    getEvent(slug)
      .then(
        (event) =>
          live &&
          setState({
            status: "ready",
            event: {
              ...event,
              hosts: event.hosts || "the hosts",
              prompt: event.prompt || "Leave a message for the hosts.",
            },
          }),
      )
      .catch((e) => live && setState({ status: e?.code === "NOT_FOUND" ? "not-found" : "error" }));
    return () => {
      live = false;
    };
  }, [slug, simulate, attempt]);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry };
}
