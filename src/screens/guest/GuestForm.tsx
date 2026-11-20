import { uploadImage } from "../../api/uploads";
import type { CaptchaResponse } from "../../types/guest";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { getPreset } from "../../api/previews";
import { sendGuestCode, submitEntry, type GuestEvent } from "../../api/guest";
import { Captcha } from "../../components/Captcha";
import { FormAlert } from "../../components/FormAlert";
import { GuestPagePreview } from "../../components/GuestPagePreview";
import { PHOTO_ERRORS, PhotoUpload } from "../../components/PhotoUpload";
import { StatusPanel } from "../../components/StatusPanel";
import { LIMITS } from "../../constants";
import { useOnline } from "../../hooks/useOnline";
import { isEmail } from "../../lib/validation";
import { useApp } from "../../store";
import { Button, Input, Textarea, cx } from "../../ui";
import { errorCode } from "../auth/usePreset";
import { GuestGate } from "./GuestGate";
import { GuestHeader } from "./GuestHeader";
import { useGuestDraft } from "./guestDraft";
import { needsEmail, needsName } from "./summary";

export function GuestForm() {
  const { route } = useApp();
  const slug = route.path[0]!;
  const variant = route.query.get("variant");
  const online = useOnline(variant === "offline");
  return (
    <GuestGate
      slug={slug}
      simulate={variant === "not-live" || variant === "closed" ? variant : undefined}
      offline={!online}
      header={(e) => (
        <GuestHeader back={`/${slug}/join`} step={needsEmail(e) ? "Step 1 of 2" : undefined} />
      )}
    >
      {(event) => <Form event={event} variant={variant} online={online} />}
    </GuestGate>
  );
}

function Form({
  event,
  variant,
  online,
}: {
  event: GuestEvent;
  variant: string | null;
  online: boolean;
}) {
  const { navigate } = useApp();
  const { draft, update } = useGuestDraft(event.slug);
  const preset = getPreset("guest-form", variant);
  const [tried, setTried] = useState(false);
  const [photoError, setPhotoError] = useState<string | undefined>(
    preset.photoError ? PHOTO_ERRORS[preset.photoError] : undefined,
  );
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [failure, setFailure] = useState<"upload" | "server" | "offline" | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [preview, setPreview] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const [draftId] = useState(() => draft.draftId ?? crypto.randomUUID());
  const onGrant = useCallback(
    (grant: CaptchaResponse) =>
      update({
        draftId,
        captcha: grant.token,
        uploadToken: grant.uploadToken,
        expiresAt: grant.expiresAt,
      }),
    [draftId, update],
  );
  useEffect(() => {
    if (!draft.expiresAt || !draft.captcha) return;
    const timer = window.setTimeout(
      () => update({ captcha: null, uploadToken: undefined }),
      Math.max(0, Date.parse(draft.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [draft.expiresAt, draft.captcha, update]);

  const verify = needsEmail(event);
  const validate = (d: typeof draft) => ({
    name: needsName(event) && !d.name.trim() ? "Add your name" : undefined,
    email: needsEmail(event)
      ? !d.email.trim()
        ? "Add your email so we can send a code"
        : !isEmail(d.email)
          ? "Enter a valid email, like name@example.com"
          : undefined
      : d.email && !isEmail(d.email)
        ? "Enter a valid email, like name@example.com"
        : undefined,
    photo: photoError ?? (event.photoRequired && !d.photo ? "Add a photo to continue" : undefined),
    message: event.messageRequired && !d.message.trim() ? "Write a message to continue" : undefined,
    captcha: !d.captcha ? "Confirm you're a person to continue" : undefined,
  });
  const errors = validate(draft);
  const show = (k: keyof typeof errors) =>
    tried || (k === "photo" && photoError) ? errors[k] : undefined;
  const count = Object.values(errors).filter(Boolean).length;

  async function submit(d = draft) {
    setTried(true);
    setFailure(null);
    if (Object.values(validate(d)).some(Boolean)) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    if (!online || status !== "idle") return;
    setStatus("sending");
    try {
      let photo = d.uploadId;
      if (d.file && !photo) {
        if (!d.uploadToken) {
          update({ captcha: null });
          setStatus("idle");
          return;
        }
        try {
          photo = (await uploadImage(d.file, d.uploadToken)).uploadId;
          update({ uploadId: photo });
        } catch (e) {
          if (["UNAUTHORIZED", "CAPTCHA_FAILED"].includes(errorCode(e)))
            update({ captcha: null, uploadToken: undefined });
          setStatus("idle");
          setFailure("upload");
          return;
        }
      }
      if (verify) {
        await sendGuestCode(event.slug, d.email, d.captcha!);
        navigate(`/${event.slug}/join/verify`);
        return;
      }
      const r = await submitEntry(event, {
        name: d.name,
        signoff: d.signoff ?? "",
        email: d.email,
        message: d.message,
        photo,
        captcha: d.captcha!,
      });
      update({ result: r.status, captcha: null, uploadToken: undefined, file: undefined });
      navigate(`/${event.slug}/join/success`);
    } catch (e) {
      setStatus("idle");
      const c = errorCode(e);
      if (c === "CAPTCHA_FAILED") {
        update({ captcha: null, uploadToken: undefined });
        return;
      }
      if (c === "GUEST_BLOCKED") return setBlocked(true);
      if (c === "CONFLICT" || c === "NOT_FOUND") {
        navigate(`/${event.slug}/join`);
        return;
      }
      if (c === "RATE_LIMITED") return setRateLimited(true);
      setFailure(c === "UPLOAD_FAILED" ? "upload" : c === "OFFLINE" ? "offline" : "server");
      requestAnimationFrame(() => summary.current?.focus());
    }
  }

  if (draft.result)
    return (
      <StatusPanel
        icon="feather"
        title="Your page was submitted"
        body="Open your confirmation to see what happens next."
        actions={
          <Button onClick={() => navigate(`/${event.slug}/join/success`)}>View confirmation</Button>
        }
      />
    );
  if (blocked)
    return (
      <StatusPanel
        icon="lock"
        title="Submissions unavailable"
        body="The host has restricted submissions from this guest."
      />
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

  const previewNode = (
    <GuestPagePreview event={event} name={draft.signoff ?? ""} photo={draft.photo} message={draft.message} />
  );

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-6 rounded-lg bg-linen p-5 text-slate shadow-e1 md:p-8 lg:col-span-7"
      >
        <div className="flex flex-col gap-2">
          <h1 className="t-h1">Your page</h1>
          <p className="t-body">{event.prompt}</p>
        </div>

        {failure === "upload" && (
          <FormAlert
            ref={summary}
            title="Your photo didn't upload"
            action={
              <Button variant="secondary" onClick={() => submit()}>
                Try again
              </Button>
            }
          >
            Your page is saved. Check your connection and try again.
          </FormAlert>
        )}
        {failure === "server" && (
          <FormAlert ref={summary}>
            Something went wrong on our side. Try again in a moment.
          </FormAlert>
        )}
        {failure === "offline" && (
          <FormAlert ref={summary} tone="offline">
            You're offline. Your page is saved, so send it when you reconnect.
          </FormAlert>
        )}
        {tried && !failure && count > 0 && (
          <FormAlert ref={summary}>
            Fix {count} {count === 1 ? "field" : "fields"} to add your page.
          </FormAlert>
        )}

        <Input
          label={needsName(event) ? "Your name" : "Your name (optional)"}
          autoComplete="name"
          value={draft.name}
          maxLength={LIMITS.personName}
          placeholder="Name"
          onChange={(e) => update({ name: e.target.value })}
          error={show("name")}
          disabled={status === "sending"}
          helper="Used by the event manager. Your sign-off below is shown in the book."
        />
        {needsEmail(event) && (
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={draft.email}
            onChange={(e) => update({ email: e.target.value })}
            error={show("email")}
            disabled={status === "sending"}
            helper="We'll send a code to confirm it. It's never shown in the book."
          />
        )}
        <Input label="Sign-off name (optional)" value={draft.signoff ?? ""} maxLength={LIMITS.personName} onChange={e => update({ signoff: e.target.value })} placeholder="Name" helper="Leave blank to stay anonymous in the book." />
        <PhotoUpload
          label={event.photoRequired ? "Photo" : "Photo (optional)"}
          value={draft.photo}
          onChange={(photo, file) => {
            setPhotoError(undefined);
            update({ photo, file, uploadId: undefined });
          }}
          onReject={setPhotoError}
          error={show("photo")}
          disabled={status === "sending"}
        />
        <Textarea
          label={event.messageRequired ? "Message" : "Message (optional)"}
          value={draft.message}
          max={LIMITS.message}
          rows={5}
          onChange={(e) => update({ message: e.target.value })}
          error={show("message")}
          disabled={status === "sending"}
          placeholder="Write your message"
        />

        <div className="lg:hidden">
          <Button
            variant="secondary"
            full
            aria-expanded={preview}
            onClick={() => setPreview((p) => !p)}
            iconRight={
              <ChevronDown
                className={cx("size-5 transition-transform", preview && "rotate-180")}
                aria-hidden="true"
              />
            }
          >
            {preview ? "Hide preview" : "Preview your page"}
          </Button>
          {preview && (
            <div className="anim-fade mx-auto mt-4 w-full max-w-[300px]">{previewNode}</div>
          )}
        </div>

        <Captcha
          slug={event.slug}
          draftId={draftId}
          confirmed={!!draft.captcha}
          onGrant={onGrant}
          error={show("captcha")}
        />

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            size="lg"
            full
            loading={status === "sending"}
            disabled={!online}
            className="lg:w-auto lg:self-start"
          >
            {status === "sending"
              ? verify
                ? "Sending code"
                : "Adding your page"
              : verify
                ? "Continue"
                : "Add my page"}
          </Button>
          {!online && (
            <p className="t-caption">
              Reconnect to send your page. Nothing you've written is lost.
            </p>
          )}
          <p className="t-caption text-muted">
            By adding a page, you agree {event.hosts} can include it in their book.
          </p>
        </div>
      </form>

      <aside aria-label="Page preview" className="hidden lg:col-span-5 lg:block">
        <div className="sticky top-6 flex flex-col gap-3">
          <p className="t-caption font-medium">Preview</p>
          {previewNode}
        </div>
      </aside>
    </div>
  );
}
