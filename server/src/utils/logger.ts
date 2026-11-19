import type { Env } from "../config/env.js";

type LogFields = {
  requestId?: string;
  code?: string;
  port?: number;
  host?: string;
  signal?: string;
  uploadId?: string;
};
export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}
const priority = { info: 0, warn: 1, error: 2 };

/** Intentionally accepts no raw requests, headers, URLs, errors, or configuration objects. */
export function createLogger(level: Env["LOG_LEVEL"] = "info"): Logger {
  const write = (severity: keyof typeof priority, event: string, fields: LogFields = {}) => {
    if (priority[severity] < priority[level]) return;
    const entry = JSON.stringify({
      time: new Date().toISOString(),
      level: severity,
      event,
      ...fields,
    });
    if (severity === "error") console.error(entry);
    else if (severity === "warn") console.warn(entry);
    else console.info(entry);
  };
  return {
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}
