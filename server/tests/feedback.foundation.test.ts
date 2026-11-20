import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { feedbackBody } from "../src/routes/feedback.js";
import { guestEntryBody } from "../src/validators/guests.js";
import { Feedback } from "../src/models/Feedback.js";
import { testConfig, testLogger } from "./helpers.js";

describe("private feedback and signatures", () => {
  it("bounds messages and rejects privileged fields", () => {
    expect(feedbackBody.parse({ message: " Thank you " })).toEqual({ name: "", message: "Thank you" });
    for (const body of [{ message: " " }, { message: "a".repeat(1001) }, { message: "Hi", bookId: "foreign" }, { message: { $ne: null } }])
      expect(feedbackBody.safeParse(body).success).toBe(false);
  });
  it("authenticates before querying the inbox", async () => {
    const find = vi.spyOn(Feedback, "find");
    const app = createApp({ config: testConfig(), isDatabaseReady: () => true, logger: testLogger() });
    await request(app).get("/api/books/" + "a".repeat(24) + "/feedback").expect(401);
    expect(find).not.toHaveBeenCalled();
    find.mockRestore();
  });
  it("allows an anonymous sign-off without removing the manager's required guest identity", () => {
    const entry = guestEntryBody.parse({ name: "Guest", email: "", message: "Hello", captcha: "proof", signoff: "" });
    expect(entry.name).toBe("Guest");
    expect(entry.signoff).toBe("");
    expect(guestEntryBody.parse({ ...entry, signoff: " Ava " }).signoff).toBe("Ava");
    expect(guestEntryBody.safeParse({ ...entry, signoff: "a".repeat(1000) }).success).toBe(false);
  });
});
