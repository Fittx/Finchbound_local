import { PRESETS, type Preset } from "../mocks/previews";

/**
 * Client-only (no HTTP). Returns the prefilled state for a design frame (?variant=),
 * or an empty preset. Delete with src/mocks once frames are no longer needed.
 */
export function getPreset(screen: string, variant: string | null): Preset {
  if (!import.meta.env.DEV) return {};
  return (variant && PRESETS[screen]?.[variant]) || {};
}
export type { Preset };
