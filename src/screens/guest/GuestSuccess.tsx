import { FeatherBurst } from "../../book";
import { FeatherMark } from "../../brand";
import { GuestPagePreview } from "../../components/GuestPagePreview";
import { useApp } from "../../store";
import { Button } from "../../ui";
import { GuestGate } from "./GuestGate";
import { useGuestDraft } from "./guestDraft";
import type { GuestEvent } from "../../api/guest";

export function GuestSuccess() {
  const { route } = useApp();
  const slug = route.path[0]!;
  return <GuestGate slug={slug}>{(event) => <Success event={event} />}</GuestGate>;
}

function Success({ event }: { event: GuestEvent }) {
  const { navigate, reduced } = useApp();
  const { draft, startAnother } = useGuestDraft(event.slug);
  if (!draft.result)
    return (
      <div className="mx-auto rounded-lg bg-linen p-6">
        <h1 className="t-h2">Open the guestbook</h1>
        <Button onClick={() => navigate(`/${event.slug}/join`)}>Go to guestbook</Button>
      </div>
    );
  const pending = draft.result === "pending";
  const { name, message, photo } = draft;
  const another = () => {
    startAnother();
    navigate(`/${event.slug}/join/form`);
  };
  const showReader = event.readerAvailable && !pending;
  const accent = event.theme.accent === "#F4A261" ? "#E63946" : event.theme.accent;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center">
      <div className="flex flex-col items-center gap-6 rounded-lg bg-linen p-6 text-center text-slate shadow-e1 md:p-10">
        {/* A static feather stays after the burst ends, so no empty band remains. */}
        <div className="relative flex h-14 w-full items-end justify-center">
          <FeatherMark className="size-12" color={accent} />
          {!reduced && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0">
              <FeatherBurst reduced={false} color={accent} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2" role="status">
          <h1 className="t-h1">
            {pending ? "Submitted for host approval" : "Thanks, your page was submitted"}
          </h1>
          <p className="t-body">
            {pending
              ? `Thanks for your page. ${event.hosts.charAt(0).toUpperCase()}${event.hosts.slice(1)} will review it before it appears in the book.`
              : `The hosts can now add your page to ${event.title}. It stays private until they place it in the book.`}
          </p>
        </div>
        <GuestPagePreview
          event={event}
          name={name}
          photo={photo}
          message={message}
          className="w-full max-w-[240px]"
        />
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {showReader ? (
            <>
              <Button variant="secondary" onClick={another}>
                Add another page
              </Button>
              <Button onClick={() => navigate(`/reader/${event.slug}`)}>Read the book</Button>
            </>
          ) : (
            <Button onClick={another}>Add another page</Button>
          )}
        </div>
      </div>
    </div>
  );
}
