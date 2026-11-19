import { describe, expect, it } from "vitest";
import { startupErrorCode } from "../src/utils/startupError.js";

describe("safe startup diagnostics", () => {
  it.each([
    [{ name: "MongoServerError", code: 18 }, "DATABASE_AUTHENTICATION_FAILED"],
    [{ name: "MongoServerError", code: 13 }, "DATABASE_PERMISSION_DENIED"],
    [{ name: "MongoServerError", code: 11000 }, "DATABASE_INDEX_CONFLICT"],
    [{ name: "MongooseServerSelectionError" }, "DATABASE_CONNECTION_FAILED"],
    [{ name: "MongoParseError" }, "DATABASE_URI_INVALID"],
    [{ code: "ENOENT" }, "STARTUP_FILE_MISSING"],
    [{ code: "EADDRINUSE" }, "PORT_ALREADY_IN_USE"],
    [{ code: "ERR_DLOPEN_FAILED" }, "NATIVE_DEPENDENCY_LOAD_FAILED"],
  ])("classifies a startup error without logging provider data", (details, expected) => {
    expect(
      startupErrorCode({ ...details, message: "private-password", stack: "private-uri" }),
    ).toBe(expected);
  });
  it("never reflects arbitrary messages, names, codes or non-error values", () => {
    for (const error of [
      undefined,
      null,
      "private-password",
      new Error("private-password"),
      { name: "private-uri", code: "private-key", message: "private-password" },
    ])
      expect(startupErrorCode(error)).toBe("STARTUP_UNEXPECTED_ERROR");
  });
});
