const HOST_ROUTES = {
  "": ["Landing", "Finchbound"],
  dashboard: ["Dashboard", "Your books"],
  create: ["Wizard", "Create a book"],
  hub: ["Hub", "Event hub"],
  editor: ["Editor", "Editor"],
  reader: ["Reader", "Reader"],
  account: ["Profile", "Account"],
  terms: ["Legal", "Terms of service"],
  privacy: ["Legal", "Privacy policy"],
  signin: ["SignIn", "Sign in"],
  signup: ["SignUp", "Create your account"],
  "forgot-password": ["ForgotPassword", "Reset your password"],
  "reset-password": ["ResetPassword", "Choose a new password"],
  "verify-email": ["VerifyEmail", "Verify your email"],
  "session-expired": ["SessionExpired", "Session expired"],
  "server-error": ["ServerError", "Something went wrong"],
} as const;
const GUEST_ROUTES = {
  "": ["GuestWelcome", "Add your page"],
  form: ["GuestForm", "Your page"],
  verify: ["GuestVerify", "Check your email"],
  success: ["GuestSuccess", "Thanks"],
} as const;
const NOT_FOUND = ["NotFound", "Page not found"] as const;

/** Absolute guest destination, preserving the current deployment path. */
export function guestJoinUrl(slug: string, base = window.location.href) {
  const url = new URL(base);
  url.search = "";
  url.hash = `/${encodeURIComponent(slug)}/join`;
  return url.href;
}

export function resolveRoute(path: string[]) {
  if (path[0] === "reader" && path.length === 3 && path[2] === "server-error")
    return HOST_ROUTES["server-error"];
  if (path[1] === "join") {
    if (path.length > 3) return NOT_FOUND;
    if (path[2] === "server-error") return HOST_ROUTES["server-error"];
    return GUEST_ROUTES[(path[2] ?? "") as keyof typeof GUEST_ROUTES] ?? NOT_FOUND;
  }
  const key = path[0] ?? "";
  if (key === "reader" || key === "hub" || key === "editor") {
    if (path.length !== 2) return NOT_FOUND;
  } else if (path.length > 1) return NOT_FOUND;
  return HOST_ROUTES[key as keyof typeof HOST_ROUTES] ?? NOT_FOUND;
}

/** Keep genuine form/link parameters; preview controls never affect release builds. */
export function cleanRouteQuery(raw: string, development: boolean) {
  const query = new URLSearchParams(raw);
  for (const key of ["frame", "panel", "reduced"]) query.delete(key);
  if (!development) for (const key of ["variant", "state"]) query.delete(key);
  return query;
}
