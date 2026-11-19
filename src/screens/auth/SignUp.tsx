import { useRef, useState, type MouseEvent } from "react";
import { signUp } from "../../api/auth";
import { AuthLayout } from "../../components/AuthLayout";
import { Checkbox } from "../../components/Checkbox";
import { FormAlert } from "../../components/FormAlert";
import { PasswordInput } from "../../components/PasswordInput";
import { PasswordStrength } from "../../components/PasswordStrength";
import { TextLink } from "../../components/TextLink";
import { LIMITS } from "../../constants";
import { PASSWORD_RULE, isAccountEmail, passwordError } from "../../lib/validation";
import { useApp } from "../../store";
import { Button, Input } from "../../ui";
import { errorCode } from "./usePreset";

// In-memory only: keep the sign-up form when opening a legal page and returning.
let legalDraft: {
  name: string;
  email: string;
  password: string;
  confirm: string;
  terms: boolean;
} | null = null;
export function SignUp() {
  const { navigate, route } = useApp();
  const draft = route.query.get("return") === "terms" ? legalDraft : null;
  const [name, setName] = useState(draft?.name ?? "");
  const [email, setEmail] = useState(draft?.email ?? "");
  const [password, setPassword] = useState(draft?.password ?? "");
  const [confirm, setConfirm] = useState(draft?.confirm ?? "");
  const [terms, setTerms] = useState(draft?.terms ?? false);
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [taken, setTaken] = useState(false);
  const [failure, setFailure] = useState<"offline" | "server" | null>(null);
  const summary = useRef<HTMLDivElement>(null);

  const errors = {
    name: !name.trim() ? "Enter your name" : undefined,
    email: !email.trim()
      ? "Enter your email"
      : !isAccountEmail(email)
        ? "Use a Gmail address ending in @gmail.com."
        : taken
          ? "An account with this email already exists"
          : undefined,
    password: !password ? "Create a password" : passwordError(password),
    confirm: !confirm
      ? "Confirm your password"
      : confirm !== password
        ? "Passwords don't match"
        : undefined,
    terms: !terms ? "Agree to the terms to continue" : undefined,
  };
  const show = (k: keyof typeof errors) => (tried ? errors[k] : undefined);
  const count = Object.values(errors).filter(Boolean).length;

  function rememberLegalDraft(event: MouseEvent<HTMLAnchorElement>) {
    event.stopPropagation();
    legalDraft = { name, email, password, confirm, terms };
  }

  async function submit() {
    setTried(true);
    setFailure(null);
    if (Object.values(errors).some(Boolean)) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setLoading(true);
    try {
      await signUp({ name, email, password });
      legalDraft = null;
      navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch (e) {
      setLoading(false);
      const code = errorCode(e);
      if (code === "EMAIL_TAKEN") setTaken(true);
      else setFailure(code === "OFFLINE" ? "offline" : "server");
      requestAnimationFrame(() => summary.current?.focus());
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Start your first book in a couple of minutes."
      footer={
        <>
          <span>Already have an account?</span>
          <TextLink href="#/signin">Sign in</TextLink>
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
        {tried && taken && (
          <FormAlert
            ref={summary}
            title="You already have an account"
            action={<TextLink href="#/signin">Sign in instead</TextLink>}
          >
            Sign in with {email.trim()}, or use a different email.
          </FormAlert>
        )}
        {tried && !taken && count > 0 && (
          <FormAlert ref={summary}>
            Fix {count} {count === 1 ? "field" : "fields"} to continue.
          </FormAlert>
        )}
        {failure && (
          <FormAlert ref={summary} tone={failure === "offline" ? "offline" : "error"}>
            {failure === "offline"
              ? "You're offline. Reconnect, then try again."
              : "Something went wrong on our side. Try again."}
          </FormAlert>
        )}
        <Input
          label="Name"
          autoComplete="name"
          value={name}
          maxLength={LIMITS.personName}
          onChange={(e) => setName(e.target.value)}
          error={show("name")}
          disabled={loading}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setTaken(false);
          }}
          error={show("email")}
          disabled={loading}
        />
        <div className="flex flex-col gap-2">
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={show("password")}
            helper={PASSWORD_RULE}
            disabled={loading}
          />
          <PasswordStrength value={password} />
        </div>
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={show("confirm")}
          disabled={loading}
        />
        <div>
          <Checkbox
            label="I agree to Finchbound’s terms of service and privacy policy."
            checked={terms}
            onChange={setTerms}
            error={show("terms")}
            disabled={loading}
          />
          <div className="ml-8 flex flex-wrap gap-x-4 t-caption">
            <TextLink href="#/terms?from=signup" onClick={rememberLegalDraft}>
              Terms of service
            </TextLink>
            <TextLink href="#/privacy?from=signup" onClick={rememberLegalDraft}>
              Privacy policy
            </TextLink>
          </div>
        </div>
        <Button type="submit" size="lg" full loading={loading}>
          {loading ? "Creating account" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
