/*
 * MOCK DATA: prototype only.
 * Prefilled values that let a frame open straight into a given state (?variant=...).
 */
import { PHOTOS, photo } from "../data";

export type Preset = {
  values?: Record<string, string | boolean>;
  submit?: boolean;
  simulate?: string;
  focus?: string;
  photoError?: "too-large" | "wrong-type";
  // Hub moderation frames
  filter?: string;
  query?: string;
  withPhoto?: boolean;
  select?: string[];
  modal?: "reject" | "delete" | "bulk-reject" | "detail" | "block" | "remove";
  /** Which entry a frame targets: "pending" (default), "approved", "long" or "reported". */
  entry?: "pending" | "approved" | "long" | "reported";
  run?: "add" | "reject";
  cardError?: boolean;
  scrollTo?: string;
  // Dashboard and wizard frames
  open?: string;
  step?: number;
};

const host = { email: "host@example.invalid", password: "PreviewOnly123" };
const guest = {
  name: "Jordan Lee",
  email: "jordan@example.com",
  message:
    "So happy to celebrate with you both. Here is to many more long dinners and late dances.",
  photo: photo(PHOTOS.picnic),
};

export const PRESETS: Record<string, Record<string, Preset>> = {
  signin: {
    focus: { focus: "email" },
    filled: { values: { ...host, remember: true } },
    empty: { submit: true },
    "invalid-email": {
      values: { email: "avery@finchbound", password: host.password },
      submit: true,
    },
    "wrong-credentials": { values: { email: host.email, password: "wrongpass1" }, submit: true },
    locked: { values: { email: "locked@gmail.com", password: host.password }, submit: true },
    loading: { values: host, submit: true, simulate: "loading" },
    success: { values: host, submit: true, simulate: "success-hold" },
    reset: {},
  },
  signup: {
    filled: {
      values: {
        name: "Jordan Lee",
        email: "jordan@example.com",
        password: "Nestwell2025!",
        confirm: "Nestwell2025!",
        terms: true,
      },
    },
    empty: { submit: true },
    weak: {
      values: {
        name: "Jordan Lee",
        email: "jordan@example.com",
        password: "nest",
        confirm: "nest",
        terms: true,
      },
      submit: true,
    },
    mismatch: {
      values: {
        name: "Jordan Lee",
        email: "jordan@example.com",
        password: "Nestwell2025",
        confirm: "Nestwell2024",
        terms: true,
      },
      submit: true,
    },
    taken: {
      values: {
        name: "Avery Lane",
        email: host.email,
        password: "Nestwell2025",
        confirm: "Nestwell2025",
        terms: true,
      },
      submit: true,
    },
    loading: {
      values: {
        name: "Jordan Lee",
        email: "jordan@example.com",
        password: "Nestwell2025",
        confirm: "Nestwell2025",
        terms: true,
      },
      submit: true,
      simulate: "loading",
    },
  },
  forgot: {
    "invalid-email": { values: { email: "avery@" }, submit: true },
    loading: { values: { email: host.email }, submit: true, simulate: "loading" },
    sent: { values: { email: host.email }, submit: true },
  },
  reset: {
    weak: { values: { password: "nest", confirm: "nest" }, submit: true },
    mismatch: { values: { password: "Nestwell2025", confirm: "Nestwell2024" }, submit: true },
    loading: {
      values: { password: "Nestwell2025", confirm: "Nestwell2025" },
      submit: true,
      simulate: "loading",
    },
    success: { values: { password: "Nestwell2025", confirm: "Nestwell2025" }, submit: true },
  },
  verify: {
    filled: { values: { code: "246810" } },
    error: { values: { code: "111111" }, submit: true },
    expired: { values: { code: "135790" }, submit: true },
    loading: { values: { code: "246810" }, submit: true, simulate: "loading" },
    success: { values: { code: "246810" }, submit: true, simulate: "success-hold" },
  },
  "guest-form": {
    filled: { values: { ...guest, captcha: true } },
    errors: { submit: true },
    "invalid-email": { values: { ...guest, email: "jordan@", captcha: true }, submit: true },
    "upload-failed": {
      values: { ...guest, captcha: true },
      submit: true,
      simulate: "upload-failed",
    },
    "file-too-large": {
      values: { name: guest.name, message: guest.message },
      photoError: "too-large",
    },
    "wrong-type": {
      values: { name: guest.name, message: guest.message },
      photoError: "wrong-type",
    },
    offline: { values: { name: guest.name, message: guest.message } },
    "captcha-error": { values: { ...guest }, simulate: "captcha-error" },
    "rate-limited": { values: { ...guest, captcha: true }, submit: true, simulate: "rate-limited" },
    loading: { values: { ...guest, captcha: true }, submit: true, simulate: "loading" },
  },
  "guest-verify": {
    error: { values: { code: "111111" }, submit: true },
    expired: { values: { code: "135790" }, submit: true },
    loading: { values: { code: "246810" }, submit: true, simulate: "loading" },
  },
  "guest-success": {
    added: { values: guest },
    pending: { values: guest },
  },
  hub: {
    pending: { filter: "pending" },
    "no-pending": { filter: "pending" },
    approved: { filter: "approved" },
    "in-book": { filter: "in-book" },
    rejected: { filter: "rejected" },
    "with-photo": { withPhoto: true },
    anonymous: { query: "anonymous" },
    "no-results": { query: "Zelda" },
    bulk: { filter: "pending", select: ["s-b4-2", "s-b4-3"] },
    "bulk-reject": { filter: "pending", select: ["s-b4-2", "s-b4-3"], modal: "bulk-reject" },
    reject: { modal: "reject" },
    delete: { modal: "delete", entry: "approved" },
    detail: { modal: "detail", entry: "long" },
    block: { modal: "block", entry: "reported" },
    remove: { modal: "remove", entry: "reported" },
    undo: { run: "reject" },
    added: { run: "add", entry: "approved" },
    "card-error": { cardError: true },
    reports: { scrollTo: "reports" },
    loading: { simulate: "loading" },
    error: { simulate: "error" },
  },
  dashboard: {
    "settings-personal": { open: "settings:b3" },
    "settings-event": { open: "settings:b4" },
    delete: { open: "delete:b2" },
    logout: { open: "logout" },
  },
  wizard: {
    "personal-rules": { step: 3, values: { kind: "personal", title: "Summer in Lisbon" } },
  },
};
