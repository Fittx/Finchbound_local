import { vi } from "vitest";
import { parseEnv } from "../src/config/env.js";
import type { Logger } from "../src/utils/logger.js";

export const testEnvironment = {
  NODE_ENV: "test",
  CLIENT_URL: "http://127.0.0.1:5173",
  MONGODB_URI: "mongodb://127.0.0.1:27017/?replicaSet=rs0",
  JWT_SECRET: "d6b1f2a44d2c876cae309ca151b5e287b7a215d31a49b20edccce02f0ec86c10",
};
export const testConfig = (patch: Record<string, string | undefined> = {}) =>
  parseEnv({ ...testEnvironment, ...patch });
export function testLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}
