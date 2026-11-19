import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { signIn } from "../../api/auth";
import { AuthLayout } from "../../components/AuthLayout";
import { Checkbox } from "../../components/Checkbox";
import { FormAlert } from "../../components/FormAlert";
import { PasswordInput } from "../../components/PasswordInput";
import { TextLink } from "../../components/TextLink";
import { LIMITS } from "../../constants";
import { isAccountEmail } from "../../lib/validation";
import { useApp } from "../../store";
import { Button, Input } from "../../ui";
import { errorCode } from "./usePreset";

type ServerError = "unverified" | "credentials" | "locked" | "offline" | "server";

export function SignIn() {
  const { route, navigate, toast } = useApp();
  const [verificationEmail, setVerificationEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [tried, setTried] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [serverError, setServerError] = useState<ServerError | null>(null);
  const alert = useRef<HTMLDivElement>(null);
  const passwordReset = route.query.get("reset") === "1";
  const next = route.query.get("next") || "/dashboard";
  const busy = status !== "idle";

  const emailError = tried
    ? !email.trim()
      ? "Enter your email"
      : !isAccountEmail(email)
        ? "Use a Gmail address ending in @gmail.com."
        : undefined
    : undefined;
  const passwordError = tried && !password ? "Enter your password" : undefined;

  async function submit() {
    setTried(true);
    setServerError(null);
    if (!email.trim() || !isAccountEmail(email) || !password) return;
    setStatus("loading");
    try {
      const user = await signIn({ email, password, remember });
      setStatus("success");
      window.setTimeout(() => {
        toast(`Welcome back, ${user.name.split(" ")[0]}`);
        navigate(next);
      }, 600);
    } catch (e) {
      setStatus("idle");
      const code = errorCode(e);
      if (
        code === "INVALID_CREDENTIALS" &&
        e instanceof Error &&
        e.message === "Verify your email before signing in."
      ) {
        setVerificationEmail(email.trim());
        setServerError("unverified");
        requestAnimationFrame(() => alert.current?.focus());
        return;
      }
      setServerError(
        code === "ACCOUNT_LOCKED"
          ? "locked"
          : code === "INVALID_CREDENTIALS"
            ? "credentials"
            : code === "OFFLINE"
              ? "offline"
              : "server",
      );
      requestAnimationFrame(() => alert.current?.focus());
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back to your books."
      footer={
        <>
          <span>New to Finchbound?</span>
          <TextLink href="#/signup">Create an account</TextLink>
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
        {passwordReset && !serverError && (
          <FormAlert tone="success" title="Password updated">
            Sign in with your new password.
          </FormAlert>
        )}
        {serverError === "unverified" && (
          <FormAlert
            ref={alert}
            title="Verify your email"
            action={
              <TextLink href={"#/verify-email?email=" + encodeURIComponent(verificationEmail)}>
                Enter verification code
              </TextLink>
            }
          >
            Open the code we sent you, or request a new one on the verification screen.
          </FormAlert>
        )}
        {serverError === "credentials" && (
          <FormAlert ref={alert} title="That didn't match">
            Check your email and password, or reset your password.
          </FormAlert>
        )}
        {serverError === "locked" && (
          <FormAlert
            ref={alert}
            title="Account locked"
            action={<TextLink href="#/forgot-password">Reset password</TextLink>}
          >
            Too many attempts. Try again in {LIMITS.lockMinutes} minutes, or reset your password
            now.
          </FormAlert>
        )}
        {serverError === "offline" && (
          <FormAlert ref={alert} tone="offline" title="You're offline">
            Reconnect, then try again.
          </FormAlert>
        )}
        {serverError === "server" && (
          <FormAlert ref={alert} title="Something went wrong">
            It's on our side. Try again in a moment.
          </FormAlert>
        )}
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
          disabled={busy}
        />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          disabled={busy}
        />
        <div className="-my-1 flex flex-wrap items-center justify-between gap-x-4">
          <Checkbox
            label="Keep me signed in"
            checked={remember}
            onChange={setRemember}
            disabled={busy}
          />
          <TextLink href="#/forgot-password">Forgot password?</TextLink>
        </div>
        <Button
          type="submit"
          size="lg"
          full
          loading={status === "loading"}
          disabled={status === "success"}
          icon={status === "success" ? <Check className="size-5" aria-hidden="true" /> : undefined}
          className={status === "success" ? "disabled:bg-pine disabled:text-white" : undefined}
        >
          {status === "loading" ? "Signing in" : status === "success" ? "Signed in" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
