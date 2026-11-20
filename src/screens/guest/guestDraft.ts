import { useCallback, useSyncExternalStore } from "react";

export type GuestDraft = {
  signoff?: string;
  name: string;
  email: string;
  photo?: string;
  file?: File;
  uploadId?: string;
  uploadToken?: string;
  expiresAt?: string;
  draftId?: string;
  message: string;
  captcha: string | null;
  result?: "added" | "pending";
};

const EMPTY: GuestDraft = { name: "", email: "", message: "", captcha: null };
const drafts = new Map<string, GuestDraft>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** A guest's in-progress page, kept on this device across the welcome, form, verify and success steps. */
export function useGuestDraft(slug: string) {
  const draft = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => drafts.get(slug) ?? EMPTY,
  );
  const update = useCallback((patch: Partial<GuestDraft>) => updateGuestDraft(slug, patch), [slug]);
  const startAnother = useCallback(() => startAnotherGuestDraft(slug), [slug]);
  return { draft, update, startAnother };
}

/** Draft storage owns temporary photo URLs, independently of mounted screens. */
export function updateGuestDraft(slug: string, patch: Partial<GuestDraft>) {
  const previous = drafts.get(slug)?.photo;
  if ("photo" in patch && previous !== patch.photo && previous?.startsWith("blob:"))
    URL.revokeObjectURL(previous);
  drafts.set(slug, { ...(drafts.get(slug) ?? EMPTY), ...patch });
  emit();
}

export function startAnotherGuestDraft(slug: string) {
  const d = drafts.get(slug) ?? EMPTY;
  if (d.photo?.startsWith("blob:")) URL.revokeObjectURL(d.photo);
  drafts.set(slug, { ...EMPTY, name: d.name, email: d.email });
  emit();
}
