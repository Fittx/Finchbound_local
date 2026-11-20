import { useEffect, useState } from "react";
import { checkResetToken, resetPassword } from "../../api/auth";
import { AuthLayout } from "../../components/AuthLayout";
import { FormAlert } from "../../components/FormAlert";
import { PasswordInput } from "../../components/PasswordInput";
import { PasswordStrength } from "../../components/PasswordStrength";
import { TextLink } from "../../components/TextLink";
import { PASSWORD_RULE, passwordError } from "../../lib/validation";
import { useApp } from "../../store";
import { Button, Skeleton } from "../../ui";
import { errorCode } from "./usePreset";

export function ResetPassword() {
  const { route, navigate } = useApp();
  const token = route.query.get("token");
  const [attempt, setAttempt] = useState(0);
  const [link, setLink] = useState<"checking" | "valid" | "expired" | "error">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [failure, setFailure] = useState(false);

  useEffect(() => {
    let live = true;
    setLink("checking");
    checkResetToken(token)
      .then(() => {
        if (!live) return;
        setLink("valid");
      })
      .catch((e) => {
        if (live)
          setLink(
            ["TOKEN_EXPIRED", "VALIDATION_FAILED"].includes(errorCode(e)) ? "expired" : "error",
          );
      });
    return () => {
      live = false;
    };
  }, [token, attempt]);

  const errors = {
    password: !password ? "Create a new password" : passwordError(password),
    confirm: !confirm
      ? "Confirm your new password"
      : confirm !== password
        ? "Passwords don't match"
        : undefined,
  };

  async function submit() {
    setTried(true);
    setFailure(false);
    if (errors.password || errors.confirm) return;
    setStatus("loading");
    try {
      await resetPassword(token ?? "", password);
      setStatus("done");
    } catch (e) {
      setStatus("idle");
      if (errorCode(e) === "TOKEN_EXPIRED") setLink("expired");
      else setFailure(true);
    }
  }

  if (link === "checking")
    return (
      <AuthLayout title="Reset your password" description="Checking your reset link.">
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-13 w-full rounded-md" />
        </div>
      </AuthLayout>
    );

  if (link === "error")
    return (
      <AuthLayout
        title="Couldn't check your reset link"
        description="Check your connection and try again."
      >
        <Button onClick={() => setAttempt((value) => value + 1)}>Retry</Button>
      </AuthLayout>
    );

  if (link === "expired")
    return (
      <AuthLayout
        title="This link expired"
        description="Reset links work for 1 hour. Request a new one to continue."
        footer={<TextLink href="/signin">Back to sign in</TextLink>}
      >
        <Button size="lg" full onClick={() => navigate("/forgot-password")}>
          Request a new link
        </Button>
      </AuthLayout>
    );

  if (status === "done")
    return (
      <AuthLayout title="Password updated" description="Sign in with your new password.">
        <Button size="lg" full onClick={() => navigate("/signin?reset=1")}>
          Sign in
        </Button>
      </AuthLayout>
    );

  return (
    <AuthLayout
      title="Choose a new password"
      description="Use something you don't use on other sites."
      footer={<TextLink href="/signin">Back to sign in</TextLink>}
    >
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {failure && <FormAlert>We couldn't update your password. Try again in a moment.</FormAlert>}
        <div className="flex flex-col gap-2">
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={tried ? errors.password : undefined}
            helper={PASSWORD_RULE}
            disabled={status === "loading"}
          />
          <PasswordStrength value={password} />
        </div>
        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={tried ? errors.confirm : undefined}
          disabled={status === "loading"}
        />
        <Button type="submit" size="lg" full loading={status === "loading"}>
          {status === "loading" ? "Updating password" : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
