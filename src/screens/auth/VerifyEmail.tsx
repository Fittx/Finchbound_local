import { useEffect, useState } from "react";
import { getAccount, updateAccount } from "../../api/account";
import { Check } from "lucide-react";
import { resendCode, verifyEmail } from "../../api/auth";
import { AuthLayout } from "../../components/AuthLayout";
import { FormAlert } from "../../components/FormAlert";
import { OtpInput } from "../../components/OtpInput";
import { TextLink } from "../../components/TextLink";
import { LIMITS } from "../../constants";
import { useCountdown } from "../../hooks/useCountdown";
import { maskEmail } from "../../lib/validation";
import { useApp } from "../../store";
import { Button } from "../../ui";
import { errorCode } from "./usePreset";

export function VerifyEmail() {
  const { route, navigate, toast } = useApp();
  const email = route.query.get("email") || "";
  const changing = route.query.get("from") === "account";
  const [code, setCode] = useState("");
  const [tried, setTried] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState<string>();
  const cooldown = useCountdown();

  useEffect(() => cooldown.start(LIMITS.otpResendSeconds), [cooldown.start]);

  async function submit(value = code) {
    setTried(true);
    setError(undefined);
    if (value.length < LIMITS.otpLength) return setError(`Enter all ${LIMITS.otpLength} digits`);
    setStatus("loading");
    try {
      await verifyEmail(email, value);
      setStatus("success");
      window.setTimeout(() => {
        toast("Email verified. Welcome to Finchbound");
        navigate(changing ? "/account" : "/dashboard");
      }, 600);
    } catch (e) {
      setStatus("idle");
      const c = errorCode(e);
      if (c === "CODE_EXPIRED") {
        setError("That code expired. Request a new one below.");
        cooldown.start(0);
      } else if (c === "INVALID_CODE")
        setError("That code isn't right. Check the email and try again.");
      else if (c === "OFFLINE") setError("You're offline. Reconnect, then try again.");
      else setError("Something went wrong. Try again in a moment.");
    }
  }

  return (
    <AuthLayout
      title="Verify your email"
      description={`Enter the ${LIMITS.otpLength}-digit code we sent to ${maskEmail(email)}.`}
      footer={
        <>
          <span>Wrong email?</span>
          <TextLink href={changing ? "/account" : "/signup"}>Use a different email</TextLink>
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
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (tried) setError(undefined);
          }}
          onComplete={(v) => status === "idle" && submit(v)}
          error={error}
          loading={status === "loading"}
          disabled={status === "success"}
        />
        {status === "success" && <FormAlert tone="success">Email verified.</FormAlert>}
        <Button
          type="submit"
          size="lg"
          full
          loading={status === "loading"}
          disabled={status === "success"}
          icon={status === "success" ? <Check className="size-5" aria-hidden="true" /> : undefined}
          className={status === "success" ? "disabled:bg-pine disabled:text-white" : undefined}
        >
          {status === "loading" ? "Verifying" : status === "success" ? "Verified" : "Verify email"}
        </Button>
        <p className="flex flex-wrap items-center justify-center gap-x-1 t-body">
          Didn't get a code?
          {cooldown.remaining > 0 ? (
            <span className="flex min-h-11 items-center text-muted">
              Resend in {cooldown.label}
            </span>
          ) : (
            <Button
              variant="link"
              onClick={async () => {
                try {
                  if (changing) {
                    const { user } = await getAccount();
                    await updateAccount({ name: user.name, email });
                  } else await resendCode(email);
                } catch {
                  setError("Couldn't resend the code. Try again shortly.");
                  return;
                }
                setError(undefined);
                setCode("");
                cooldown.start(LIMITS.otpResendSeconds);
                toast("New code sent");
              }}
            >
              Resend code
            </Button>
          )}
        </p>
      </form>
    </AuthLayout>
  );
}
