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

/** Legacy state hooks carry no prefilled data. */
export function getPreset(_screen: string, _variant: string | null): Preset { return {}; }
