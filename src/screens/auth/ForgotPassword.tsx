import { useState } from "react";
import { requestPasswordReset } from "../../api/auth";
import { AuthLayout } from "../../components/AuthLayout";
import { FormAlert } from "../../components/FormAlert";
import { TextLink } from "../../components/TextLink";
import { LIMITS } from "../../constants";
import { useCountdown } from "../../hooks/useCountdown";
import { isAccountEmail } from "../../lib/validation";

import { Button, Input } from "../../ui";
import { errorCode } from "./usePreset";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [tried, setTried] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [failure, setFailure] = useState<"offline" | "server" | null>(null);
  const cooldown = useCountdown();

  const error = tried
    ? !email.trim()
      ? "Enter your email"
      : !isAccountEmail(email)
        ? "Use a Gmail address ending in @gmail.com."
        : undefined
    : undefined;

  async function submit() {
    setTried(true);
    setFailure(null);
    if (!email.trim() || !isAccountEmail(email)) return;
    setStatus("loading");
    try {
      await requestPasswordReset(email);
      setStatus("sent");
      cooldown.start(LIMITS.otpResendSeconds);
    } catch (e) {
      setStatus("idle");
      setFailure(errorCode(e) === "OFFLINE" ? "offline" : "server");
    }
  }

  if (status === "sent")
    return (
      <AuthLayout
        title="Check your email"
        description={`If an account exists for ${email.trim()}, we sent a link to reset your password.`}
        footer={<TextLink href="/signin">Back to sign in</TextLink>}
      >
        <div className="flex flex-col gap-5">
          <p className="flex flex-wrap items-center gap-x-1 t-body">
            Didn't get it?
            {cooldown.remaining > 0 ? (
              <span className="flex min-h-11 items-center text-muted">
                Resend in {cooldown.label}
              </span>
            ) : (
              <Button variant="link" onClick={() => void submit()}>
                Resend link
              </Button>
            )}
          </p>
        </div>
      </AuthLayout>
    );

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your email and we'll send you a reset link."
      footer={
        <>
          <span>Remembered it?</span>
          <TextLink href="/signin">Back to sign in</TextLink>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {failure && (
          <FormAlert tone={failure === "offline" ? "offline" : "error"}>
            {failure === "offline"
              ? "You're offline. Reconnect, then try again."
              : "Something went wrong. Try again in a moment."}
          </FormAlert>
        )}
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          disabled={status === "loading"}
        />
        <Button type="submit" size="lg" full loading={status === "loading"}>
          {status === "loading" ? "Sending link" : "Send reset link"}
        </Button>
      </form>
    </AuthLayout>
  );
}
