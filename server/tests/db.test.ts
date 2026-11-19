import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase } from "../src/config/db.js";
import { testConfig } from "./helpers.js";

vi.mock("mongoose", () => ({
  default: {
    set: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connection: { readyState: 0, db: { admin: () => ({ command: hello }) } },
  },
}));
const { hello } = vi.hoisted(() => ({ hello: vi.fn() }));

beforeEach(() => {
  vi.mocked(mongoose.connect).mockResolvedValue(mongoose);
  vi.mocked(mongoose.disconnect).mockResolvedValue(undefined);
  hello.mockResolvedValue({ setName: "rs0" });
});

describe("MongoDB connection boundary", () => {
  it("disables buffering and uses an explicit database and finite selection timeout", async () => {
    await createDatabase(testConfig()).connect();
    expect(mongoose.set).toHaveBeenCalledWith("bufferCommands", false);
    expect(mongoose.set).toHaveBeenCalledWith("sanitizeFilter", true);
    expect(mongoose.connect).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        dbName: "finchbound",
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
      }),
    );
    expect(hello).toHaveBeenCalledWith({ hello: 1 });
  });
  it("rejects standalone databases because later writes require transactions", async () => {
    hello.mockResolvedValue({ isWritablePrimary: true });
    await expect(createDatabase(testConfig()).connect()).rejects.toThrow(/replica set/);
    expect(mongoose.disconnect).toHaveBeenCalled();
  });
  it("cleans up a failed connection", async () => {
    vi.mocked(mongoose.connect).mockRejectedValue(new Error("connection failed"));
    await expect(createDatabase(testConfig()).connect()).rejects.toThrow("connection failed");
    expect(mongoose.disconnect).toHaveBeenCalled();
  });
  it("accepts a sharded cluster", async () => {
    hello.mockResolvedValue({ msg: "isdbgrid" });
    await expect(createDatabase(testConfig()).connect()).resolves.toBeUndefined();
  });
});
