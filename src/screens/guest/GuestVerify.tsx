import { useState } from "react";
import { sendGuestCode, submitEntry, verifyGuestCode, type GuestEvent } from "../../api/guest";
import { FormAlert } from "../../components/FormAlert";
import { OtpInput } from "../../components/OtpInput";
import { StatusPanel } from "../../components/StatusPanel";
import { TextLink } from "../../components/TextLink";
import { LIMITS } from "../../constants";
import { useCountdown } from "../../hooks/useCountdown";
import { useOnline } from "../../hooks/useOnline";
import { maskEmail } from "../../lib/validation";
import { useApp } from "../../store";
import { Button } from "../../ui";
import { errorCode } from "../auth/usePreset";
import { GuestGate } from "./GuestGate";
import { GuestHeader } from "./GuestHeader";
import { useGuestDraft } from "./guestDraft";

export function GuestVerify() {
  const { route } = useApp();
  const slug = route.path[0]!;
  const variant = route.query.get("variant");
  const online = useOnline(variant === "offline");
  return (
    <GuestGate
      slug={slug}
      offline={!online}
      header={() => <GuestHeader back={`/${slug}/join/form`} step="Step 2 of 2" />}
    >
      {(event) => <Verify event={event} />}
    </GuestGate>
  );
}

function Verify({ event }: { event: GuestEvent }) {
  const { navigate, toast } = useApp();
  const { draft, update } = useGuestDraft(event.slug);
  const email = draft.email;
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "adding">("idle");
  const [error, setError] = useState<string>();
  const [rateLimited, setRateLimited] = useState(false);
  const cooldown = useCountdown(LIMITS.otpResendSeconds);

  async function submit(value = code) {
    setError(undefined);
    if (!verified && value.length < LIMITS.otpLength)
      return setError(`Enter all ${LIMITS.otpLength} digits`);
    setStatus("checking");
    try {
      if (!verified) {
        await verifyGuestCode(event.slug, email, value, draft.captcha ?? "");
        setVerified(true);
      }
      setStatus("adding");
      const r = await submitEntry(event, {
        name: draft.name,
        email,
        photo: draft.uploadId,
        message: draft.message,
        captcha: draft.captcha ?? "",
      });
      update({ result: r.status, captcha: null, uploadToken: undefined, file: undefined });
      navigate(`/${event.slug}/join/success`);
    } catch (e) {
      setStatus("idle");
      const c = errorCode(e);
      if (c === "CAPTCHA_FAILED" || c === "UNAUTHORIZED") {
        update({ captcha: null, uploadToken: undefined });
        navigate(`/${event.slug}/join/form`);
        return;
      }
      if (c === "CONFLICT" || c === "NOT_FOUND") {
        navigate(`/${event.slug}/join`);
        return;
      }
      if (c === "GUEST_BLOCKED")
        return setError("The host has restricted submissions from this guest.");
      if (c === "RATE_LIMITED") return setRateLimited(true);
      if (c === "CODE_EXPIRED") {
        setError("That code expired. Request a new one below.");
        cooldown.start(0);
      } else if (c === "INVALID_CODE")
        setError("That code isn't right. Check your email and try again.");
      else if (c === "UPLOAD_FAILED") setError("Your photo didn't upload. Try again.");
      else if (c === "OFFLINE") setError("You're offline. Reconnect, then try again.");
      else setError("Something went wrong. Try again in a moment.");
    }
  }

  if (!email || !draft.captcha)
    return (
      <div className="mx-auto flex w-full max-w-[520px] flex-1 items-center">
        <StatusPanel
          icon="feather"
          className="w-full"
          title="Start with your page"
          body="Add your details first, then we'll send you a code."
          actions={
            <Button onClick={() => navigate(`/${event.slug}/join/form`)}>Go to your page</Button>
          }
        />
      </div>
    );

  if (rateLimited)
    return (
      <div className="mx-auto flex w-full max-w-[520px] flex-1 items-center">
        <StatusPanel
          icon="clock"
          className="w-full"
          title="Too many pages from this device"
          body={`Your page is saved here. Wait ${LIMITS.rateLimitMinutes} minutes, then try again.`}
          actions={
            <Button onClick={() => navigate(`/${event.slug}/join`)}>Back to the guestbook</Button>
          }
        />
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-6 rounded-lg bg-linen p-5 text-slate shadow-e1 md:p-8"
      >
        <div className="flex flex-col gap-2">
          <h1 className="t-h1">Check your email</h1>
          <p className="t-body">
            Enter the {LIMITS.otpLength}-digit code we sent to {maskEmail(email)}.
          </p>
        </div>
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v);
            setError(undefined);
          }}
          onComplete={(v) => status === "idle" && submit(v)}
          error={error}
          loading={status === "checking"}
          disabled={status === "adding"}
        />
        {status === "adding" && (
          <FormAlert tone="success">Email confirmed. Adding your page.</FormAlert>
        )}
        <Button type="submit" size="lg" full loading={status !== "idle"}>
          {status === "checking"
            ? "Checking code"
            : status === "adding"
              ? "Adding your page"
              : "Verify and add my page"}
        </Button>
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="flex flex-wrap items-center justify-center gap-x-1 t-body">
            Didn't get it?
            {cooldown.remaining > 0 ? (
              <span className="flex min-h-11 items-center text-muted">
                Resend in {cooldown.label}
              </span>
            ) : (
              <Button
                variant="link"
                onClick={async () => {
                  try {
                    await sendGuestCode(event.slug, email, draft.captcha ?? "");
                    setVerified(false);
                  } catch (e) {
                    if (errorCode(e) === "CAPTCHA_FAILED") {
                      update({ captcha: null });
                      navigate(`/${event.slug}/join/form`);
                    } else setError("Couldn't resend the code. Try again shortly.");
                    return;
                  }
                  setCode("");
                  setError(undefined);
                  cooldown.start(LIMITS.otpResendSeconds);
                  toast("New code sent");
                }}
              >
                Resend code
              </Button>
            )}
          </p>
          <TextLink href={`#/${event.slug}/join/form`}>Change email</TextLink>
        </div>
      </form>
    </div>
  );
}
