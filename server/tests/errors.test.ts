import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "../src/utils/ApiError.js";
import { asyncHandler } from "../src/utils/asyncHandler.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { validate } from "../src/middleware/validate.js";
import { testLogger } from "./helpers.js";

describe("error and validation boundaries", () => {
  it("forwards asynchronous errors without exposing their message, stack or secrets", async () => {
    const app = express();
    const logger = testLogger();
    app.get(
      "/",
      asyncHandler(async () => {
        throw new Error("mongodb://user:password@host/private");
      }),
    );
    app.use(errorHandler(logger));
    const response = await request(app).get("/").expect(500);
    expect(response.body).toEqual({
      error: { code: "SERVER", message: "Something went wrong. Try again later." },
    });
    expect(JSON.stringify(response.body)).not.toContain("password");
    expect(logger.error).toHaveBeenCalledWith("request_failed", { requestId: "", code: "SERVER" });
  });
  it.each([
    [
      { code: 11000, keyPattern: { email: 1 }, keyValue: { email: "private@address.invalid" } },
      409,
      "EMAIL_TAKEN",
    ],
    [{ code: 11000, keyPattern: { slug: 1 } }, 409, "CONFLICT"],
    [{ name: "CastError", value: { $ne: null } }, 400, "VALIDATION_FAILED"],
    [{ name: "ValidationError" }, 400, "VALIDATION_FAILED"],
  ] as const)("maps database errors to a safe envelope", async (error, status, code) => {
    const app = express();
    app.get("/", (_req, _res, next) => next(error));
    app.use(errorHandler(testLogger()));
    const response = await request(app).get("/").expect(status);
    expect(response.body.error.code).toBe(code);
    expect(JSON.stringify(response.body)).not.toContain("private@address");
  });
  it("preserves allowed field errors and their HTTP status", async () => {
    const error = new ApiError("VALIDATION_FAILED", undefined, { email: "Enter a valid email" });
    expect(error.status).toBe(400);
    expect(error.toBody().error.fields).toEqual({ email: "Enter a valid email" });
  });
  it("validates bodies, params and queries, rejects unknown fields, and stores parsed values", async () => {
    const app = express();
    app.use(express.json());
    app.post(
      "/:id",
      validate({
        body: z.strictObject({ title: z.string().max(80) }),
        params: z.strictObject({ id: z.string().regex(/^[a-f0-9]{24}$/) }),
        query: z.strictObject({ limit: z.coerce.number().int().min(1).max(100).default(12) }),
      }),
      (_req, res) => res.json(res.locals.validated),
    );
    app.use(errorHandler(testLogger()));
    const id = "a".repeat(24);
    const response = await request(app)
      .post("/" + id + "?limit=8")
      .send({ title: "Book" })
      .expect(200);
    expect(response.body.query.limit).toBe(8);
    await request(app)
      .post("/" + id)
      .send({ title: "Book", ownerId: "attacker" })
      .expect(400);
    await request(app).post("/bad-id").send({ title: "Book" }).expect(400);
    await request(app)
      .post("/" + id + "?limit=101")
      .send({ title: "Book" })
      .expect(400);
  });
});
