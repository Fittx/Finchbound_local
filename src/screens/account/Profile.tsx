import { useEffect, useRef, useState } from "react";
import { getAccount, updateAccount } from "../../api/account";
import { ApiError } from "../../api/client";
import { useSession } from "../../api/session";
import { FormAlert } from "../../components/FormAlert";
import { LogoutModal } from "../../components/LogoutModal";
import { SiteFooter } from "../../components/SiteFooter";
import { Container, TopBar } from "../../shell";
import { useApp } from "../../store";
import { Button, Input, Skeleton } from "../../ui";
import { LIMITS } from "../../constants";
import { isAccountEmail } from "../../lib/validation";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { DeleteAccountModal } from "./DeleteAccountModal";
export function Profile() {
  const { route, navigate } = useApp();
  const session = useSession();
  const variant = route.query.get("variant") ?? "";
  const [account, setAccount] = useState(session);
  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [status, setStatus] = useState(
    ["saving", "saved", "error", "email-used"].includes(variant) ? variant : "default",
  );
  const [modal, setModal] = useState(
    variant.startsWith("password")
      ? "password"
      : variant.startsWith("delete")
        ? "delete"
        : variant === "logout"
          ? "logout"
          : "",
  );
  const [tried, setTried] = useState(false);
  const dirty = useRef(false);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoadStatus("loading");
    getAccount()
      .then((r) => {
        if (alive) {
          setLoadStatus("ready");
          setAccount(r.user);
          if (!dirty.current) {
            setName(r.user.name);
            setEmail(r.user.email);
          }
        }
      })
      .catch((e) => {
        if (alive && e instanceof ApiError && e.code === "UNAUTHORIZED")
          return navigate("/signin?next=/account");
        if (alive) setLoadStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [loadAttempt]);
  const busy = status === "saving";
  const nameError = tried && !name.trim() ? "Enter your name" : undefined;
  const emailError =
    status === "email-used"
      ? "This email is already used. Try another."
      : tried && !isAccountEmail(email)
        ? "Use a Gmail address ending in @gmail.com."
        : undefined;
  const save = async () => {
    setTried(true);
    if (!name.trim() || !isAccountEmail(email) || busy) return;
    setStatus("saving");
    try {
      const r = await updateAccount({ name, email });
      setAccount(r.user);
      setName(r.user.name);
      setEmail(r.user.email);
      if (email.trim().toLowerCase() !== r.user.email) {
        navigate("/verify-email?from=account&email=" + encodeURIComponent(email.trim()));
        return;
      }
      setStatus("saved");
    } catch (e) {
      setStatus(e instanceof ApiError && e.code === "EMAIL_TAKEN" ? "email-used" : "error");
    }
  };
  return (
    <div className="min-h-dvh bg-nest">
      <TopBar>
        <a className="flex min-h-11 items-center rounded-sm px-3 hover:bg-wash" href="/dashboard">
          Your books
        </a>
      </TopBar>
      <Container className="py-8 md:py-12">
        <main className="mx-auto flex max-w-2xl flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="t-h1">Account</h1>
            <p className="t-body text-muted">A little about the person behind the books.</p>
          </div>
          {loadStatus === "loading" ? (
            <div
              role="status"
              aria-label="Loading profile"
              aria-busy="true"
              className="flex flex-col gap-6 rounded-lg bg-linen p-6 shadow-e1"
            >
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : loadStatus === "error" ? (
            <FormAlert
              action={
                <Button variant="secondary" onClick={() => setLoadAttempt((n) => n + 1)}>
                  Retry
                </Button>
              }
            >
              Couldn't load your profile. Check your connection and try again.
            </FormAlert>
          ) : (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="flex flex-col gap-6 rounded-lg bg-linen p-6 shadow-e1"
              aria-busy={busy}
            >
              <h2 className="t-h2">Profile</h2>
              {status === "saved" && (
                <FormAlert tone="success">Your profile has been saved.</FormAlert>
              )}
              {status === "error" && (
                <FormAlert>
                  We couldn't save your profile. Your changes are still here. Try again.
                </FormAlert>
              )}
              <Input
                label="Name"
                value={name}
                onChange={(e) => {
                  dirty.current = true;
                  setName(e.target.value);
                  setStatus("default");
                }}
                max={LIMITS.personName}
                disabled={busy}
                error={nameError}
                autoComplete="name"
              />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => {
                  dirty.current = true;
                  setEmail(e.target.value);
                  setStatus("default");
                }}
                disabled={busy}
                error={emailError}
                autoComplete="email"
              />
              <Button type="submit" loading={busy} className="self-start">
                {busy ? "Saving" : "Save changes"}
              </Button>
            </form>
          )}
          {loadStatus === "ready" && (
            <>
              <section className="flex flex-col gap-4 rounded-lg bg-linen p-6 shadow-e1">
                <h2 className="t-h2">Security</h2>
                <Button
                  variant="secondary"
                  className="self-start"
                  onClick={() => setModal("password")}
                >
                  Change password
                </Button>

              </section>
              <section className="flex flex-col items-start gap-4 rounded-lg bg-linen p-6 shadow-e1">
                <h2 className="t-h2">Account actions</h2>
                <Button variant="secondary" onClick={() => setModal("logout")}>
                  Sign out
                </Button>
                <p className="t-caption text-muted">
                  Deleting your account permanently removes your books and entries.
                </p>
                <Button variant="destructive" onClick={() => setModal("delete")}>
                  Delete account
                </Button>
              </section>
            </>
          )}
        </main>
      </Container>
      <SiteFooter />
      <LogoutModal open={modal === "logout"} onClose={() => setModal("")} />
      {loadStatus === "ready" && modal === "password" && (
        <ChangePasswordModal variant={variant} onClose={() => setModal("")} />
      )}
      {account && modal === "delete" && (
        <DeleteAccountModal email={account.email} variant={variant} onClose={() => setModal("")} />
      )}
    </div>
  );
}
