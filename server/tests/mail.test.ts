import { describe, expect, it, vi } from "vitest";
import { createAuthMailer } from "../src/services/mail.js";
import { testConfig } from "./helpers.js";

const config = () =>
  testConfig({
    EMAIL_PROVIDER: "brevo",
    BREVO_API_KEY: "private-test-key",
    EMAIL_FROM: "verified@example.invalid",
  });

describe("HTTPS email delivery", () => {
  it("sends verification and reset messages over HTTPS using the selected sender", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify({ messageId: "accepted" }), { status: 201 }),
      );
    const mailer = createAuthMailer(config(), fetcher);
    await mailer.sendVerification("host@gmail.com", "123456");
    await mailer.sendPasswordReset(
      "host@gmail.com",
      "https://app.invalid/#/reset-password?token=test",
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(request?.redirect).toBe("error");
    expect(request?.headers).toMatchObject({ "api-key": "private-test-key" });
    expect(request?.signal).toBeInstanceOf(AbortSignal);
    const message = JSON.parse(String(request?.body));
    expect(message.sender.email).toBe("verified@example.invalid");
    expect(message.to).toEqual([{ email: "host@gmail.com" }]);
    expect(message.textContent).toContain("123456");
    expect(message.textContent).toContain("10 minutes");
    const reset = JSON.parse(String(fetcher.mock.calls[1]![1]?.body));
    expect(reset.textContent).toContain("https://app.invalid/#/reset-password?token=test");
    expect(reset.textContent).toContain("works once");
  });

  it("fails closed without the selected provider configuration", () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(() =>
      createAuthMailer(testConfig({ EMAIL_PROVIDER: "brevo" }), fetcher).assertConfigured(),
    ).toThrow("Email delivery is not configured");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([401, 429, 500])("sanitizes provider failures (%s)", async (status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private-provider-payload", { status }));
    const mailer = createAuthMailer(config(), fetcher);
    await expect(mailer.sendVerification("host@gmail.com", "123456")).rejects.toThrow(
      "Verification email could not be sent",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed acceptance and sanitizes network errors", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockRejectedValueOnce(new Error("secret-key-and-private-recipient"));
    const mailer = createAuthMailer(config(), fetcher);
    for (let i = 0; i < 2; i++)
      await expect(mailer.sendVerification("host@gmail.com", "123456")).rejects.toMatchObject({
        code: "SERVER",
        message: "Verification email could not be sent. Please try again.",
      });
  });
});
