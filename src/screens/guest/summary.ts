import type { GuestEvent } from "../../api/guest";

const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

export const needsName = (e: GuestEvent) => e.access !== "email";
export const needsEmail = (e: GuestEvent) => e.access !== "name";

/** e.g. "Needs your name and a message · Photo optional" */
export function requirements(e: GuestEvent) {
  const needed: string[] = [];
  const optional: string[] = [];
  (needsName(e) ? needed : optional).push(needsName(e) ? "your name" : "name");
  if (needsEmail(e)) needed.push("your email");
  (e.photoRequired ? needed : optional).push(e.photoRequired ? "a photo" : "photo");
  (e.messageRequired ? needed : optional).push(e.messageRequired ? "a message" : "message");
  const opt = list(optional);
  return `Needs ${list(needed)}${opt ? ` · ${opt[0]!.toUpperCase()}${opt.slice(1)} optional` : ""}`;
}
