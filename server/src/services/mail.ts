import type { Env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export interface AuthMailer {
  assertConfigured(): void;
  sendVerification(email: string, code: string): Promise<void>;
  sendPasswordReset(email: string, url: string): Promise<void>;
}

export function createAuthMailer(config: Env, fetcher: typeof fetch = fetch): AuthMailer {
  const assertConfigured = () => {
    if (config.EMAIL_PROVIDER === "brevo") {
      if (!config.BREVO_API_KEY || !config.EMAIL_FROM)
        throw new ApiError("SERVER", "Email delivery is not configured.");
      return;
    }
    if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASSWORD || !config.SMTP_FROM) {
      throw new ApiError("SERVER", "Email delivery is not configured.");
    }
  };
  const send = async (to: string, subject: string, text: string) => {
    assertConfigured();
    if (config.EMAIL_PROVIDER === "brevo") {
      // HTTPS works on hosts that block SMTP. Never surface provider payloads:
      // they may echo recipients, message contents or authentication details.
      try {
        const response = await fetcher("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": config.BREVO_API_KEY! },
          body: JSON.stringify({
            sender: { email: config.EMAIL_FROM!, name: "Finchbound" },
            to: [{ email: to }],
            subject,
            textContent: text,
          }),
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        });
        if (response.status !== 201) throw new Error();
        const result: unknown = await response.json();
        if (
          !result ||
          typeof result !== "object" ||
          !("messageId" in result) ||
          typeof result.messageId !== "string" ||
          !result.messageId
        )
          throw new Error();
      } catch {
        throw new ApiError("SERVER", "Verification email could not be sent. Please try again.");
      }
      return;
    }
    const { default: nodemailer } = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: config.SMTP_HOST!,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE === "true",
      requireTLS: config.SMTP_SECURE !== "true",
      auth: { user: config.SMTP_USER!, pass: config.SMTP_PASSWORD! },
      tls: { rejectUnauthorized: true },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      logger: false,
      debug: false,
    });
    const result = await transport.sendMail({ from: config.SMTP_FROM!, to, subject, text });
    if (!result.accepted?.length) throw new Error("Email was not accepted");
  };
  return {
    assertConfigured,
    sendVerification: (to, code) =>
      send(
        to,
        "Verify your Finchbound email",
        "Your verification code is " +
          code +
          ". It expires in " +
          config.OTP_TTL_MINUTES +
          " minutes. If you did not request it, ignore this message.",
      ),
    sendPasswordReset: (to, url) =>
      send(
        to,
        "Reset your Finchbound password",
        "Choose a new password: " +
          url +
          "\nThis link expires in " +
          config.PASSWORD_RESET_TTL_MINUTES +
          " minutes and works once. If you did not request it, ignore this message.",
      ),
  };
}
