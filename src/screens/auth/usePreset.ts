import { useEffect, useRef } from "react";
import { getPreset } from "../../api/previews";
import { useApp } from "../../store";

/**
 * Reads ?variant= so a design frame can open directly into a state.
 * `onMount` runs once (e.g. to submit a prefilled form).
 */
export function usePreset(screen: string, onMount?: (simulate?: string) => void) {
  const { route } = useApp();
  const variant = route.query.get("variant");
  const preset = getPreset(screen, variant);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (preset.submit) onMount?.(preset.simulate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const v = preset.values ?? {};
  return {
    variant,
    preset,
    str: (k: string, fallback = "") => (typeof v[k] === "string" ? (v[k] as string) : fallback),
    bool: (k: string, fallback = false) =>
      typeof v[k] === "boolean" ? (v[k] as boolean) : fallback,
  };
}

export const errorCode = (e: unknown) =>
  e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "SERVER";
