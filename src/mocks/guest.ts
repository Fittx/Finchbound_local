/*
 * MOCK DATA: prototype only.
 * Guest-facing event fixtures. Delete once GET /api/public/books/:slug is live.
 */
import { PRESETS } from "../data";
import type { GuestEvent } from "../types/guest";

export type { GuestEvent };

export const GUEST_EVENTS: Record<string, GuestEvent> = {
  "maya-and-theo": {
    slug: "maya-and-theo",
    title: "Maya & Theo's wedding",
    hosts: "Maya and Theo",
    prompt: "Share a photo from tonight and a few words for us to keep.",
    theme: { ...PRESETS.crimson.colors },
    font: "hand",
    lines: true,
    access: "name",
    photoRequired: false,
    messageRequired: true,
    status: "open",
    readerAvailable: true,
  },
  "ana-and-leo": {
    slug: "ana-and-leo",
    title: "Ana & Leo's engagement",
    hosts: "Ana and Leo",
    prompt: "Tell us how you know us, and add a photo if you have one.",
    theme: { ...PRESETS.skyline.colors },
    font: "serif",
    lines: true,
    access: "email",
    photoRequired: false,
    messageRequired: false,
    status: "open",
    readerAvailable: false,
  },
  "pine-lake-reunion": {
    slug: "pine-lake-reunion",
    title: "Pine Lake reunion",
    hosts: "the Pine Lake crew",
    prompt: "Add a photo and a memory from any summer at the lake.",
    theme: { ...PRESETS.pine.colors },
    font: "mono",
    lines: true,
    access: "strict",
    photoRequired: true,
    messageRequired: true,
    status: "open",
    readerAvailable: true,
  },
  "rosa-turns-90": {
    slug: "rosa-turns-90",
    title: "Grandma Rosa turns 90",
    hosts: "the Moreno family",
    prompt: "Share a favorite memory of Rosa.",
    theme: { ...PRESETS.golden.colors },
    font: "serif",
    lines: true,
    access: "email",
    photoRequired: true,
    messageRequired: false,
    status: "not-live",
    readerAvailable: false,
  },
  "spring-gala": {
    slug: "spring-gala",
    title: "Spring gala",
    hosts: "the gala team",
    prompt: "Thanks for celebrating with us.",
    theme: { ...PRESETS.golden.colors },
    font: "sans",
    lines: false,
    access: "name",
    photoRequired: false,
    messageRequired: false,
    status: "closed",
    readerAvailable: false,
  },
};
