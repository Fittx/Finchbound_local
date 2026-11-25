import { useEffect, useRef, useState } from "react";
import { verifyCaptcha } from "../api/guest";
import type { CaptchaResponse } from "../types/guest";
import { Button } from "../ui";
import { DEV_CAPTCHA_TOKEN } from "../constants";

type Turnstile = {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
let script: Promise<Turnstile> | undefined;
function loadWidget() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return (script ??= new Promise<Turnstile>((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    tag.async = true;
    const fail = () => {
      tag.remove();
      script = undefined;
      reject(new Error("Widget unavailable"));
    };
    tag.onload = () => (window.turnstile ? resolve(window.turnstile) : fail());
    tag.onerror = fail;
    document.head.append(tag);
  }));
}

export function Captcha({
  slug,
  draftId,
  confirmed,
  onGrant,
  error,
}: {
  slug: string;
  draftId: string;
  confirmed: boolean;
  onGrant: (grant: CaptchaResponse) => void;
  error?: string;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const key = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!key || confirmed) return;
    let active = true,
      id: string | undefined;
    setFailed(false);
    loadWidget()
      .then((api) => {
        if (!active || !mount.current) return;
        id = api.render(mount.current, {
          sitekey: key,
          action: import.meta.env.VITE_TURNSTILE_ACTION || "guest-upload",
          cData: slug + "_" + draftId,
          callback: async (token: string) => {
            try {
              const grant = await verifyCaptcha(slug, draftId, token);
              if (active) onGrant(grant);
            } catch {
              if (active) setFailed(true);
            }
          },
          "error-callback": () => {
            if (active) setFailed(true);
          },
        });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (id !== undefined) window.turnstile?.remove(id);
    };
  }, [slug, draftId, key, attempt, confirmed, onGrant]);
  return (
    <div className="flex flex-col gap-2">
      {confirmed ? (
        <p role="status">Human verification complete</p>
      ) : key ? (
        <div ref={mount} />
      ) : import.meta.env.DEV ? (
        // Local development without a Turnstile site key; stripped from production builds.
        <Button
          variant="secondary"
          className="self-start"
          onClick={async () => {
            try {
              onGrant(await verifyCaptcha(slug, draftId, DEV_CAPTCHA_TOKEN));
            } catch {
              setFailed(true);
            }
          }}
        >
          Skip check (dev only)
        </Button>
      ) : (
        <p role="alert">Human verification is unavailable. Please try again later.</p>
      )}
      {failed && !confirmed && (
        <Button onClick={() => setAttempt((n) => n + 1)}>Retry human verification</Button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
