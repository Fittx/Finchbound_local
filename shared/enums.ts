/** Wire values are independent of MongoDB field names and UI labels. */
export const BOOK_KINDS = ["event", "personal"] as const;
export const BOOK_VISIBILITIES = ["private", "link"] as const;
export const ACCESS_MODES = ["name", "email", "strict"] as const;
export const COLLECTION_STATUSES = ["open", "not-live", "closed"] as const;
export const FONT_KEYS = ["sans", "hand", "serif", "mono"] as const;
export const PRESET_KEYS = ["golden", "crimson", "skyline", "pine", "custom"] as const;
export const SUBMISSION_STATUSES = ["pending", "approved", "in-book", "rejected"] as const;
export const REPORT_REASON_VALUES = ["inappropriate", "spam", "privacy", "other"] as const;
export const ACCOUNT_PLANS = ["free", "unlimited"] as const;
