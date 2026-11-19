/** Return only fixed diagnostic labels. Driver errors can contain credentials. */
export function startupErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "STARTUP_UNEXPECTED_ERROR";
  const details = error as { name?: unknown; code?: unknown };
  if (details.name === "MongoServerError") {
    if (details.code === 18) return "DATABASE_AUTHENTICATION_FAILED";
    if (details.code === 13) return "DATABASE_PERMISSION_DENIED";
    if (details.code === 11000) return "DATABASE_INDEX_CONFLICT";
    return "DATABASE_COMMAND_FAILED";
  }
  if (
    details.name === "MongooseServerSelectionError" ||
    details.name === "MongoServerSelectionError" ||
    details.name === "MongoNetworkError"
  )
    return "DATABASE_CONNECTION_FAILED";
  if (details.name === "MongoParseError") return "DATABASE_URI_INVALID";
  switch (details.code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "DNS_LOOKUP_FAILED";
    case "EADDRINUSE":
      return "PORT_ALREADY_IN_USE";
    case "EACCES":
    case "EPERM":
      return "STARTUP_PERMISSION_DENIED";
    case "ENOENT":
      return "STARTUP_FILE_MISSING";
    case "ERR_MODULE_NOT_FOUND":
    case "MODULE_NOT_FOUND":
      return "DEPENDENCY_MISSING";
    case "ERR_DLOPEN_FAILED":
      return "NATIVE_DEPENDENCY_LOAD_FAILED";
    default:
      return "STARTUP_UNEXPECTED_ERROR";
  }
}
