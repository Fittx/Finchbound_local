import type { ReactNode } from "react";
import type { GuestEvent } from "../../api/guest";
import type { Simulate } from "../../api/client";
import { GuestLayout } from "../../components/GuestLayout";
import { StatusPanel } from "../../components/StatusPanel";
import { TextLink } from "../../components/TextLink";
import { useApp } from "../../store";
import { Button, Skeleton } from "../../ui";
import { useGuestEvent } from "./useGuestEvent";

/** Loads the event and renders loading, not found, offline, not live and closed states before the screen. */
export function GuestGate({
  slug,
  simulate,
  offline,
  header,
  reportOpen,
  children,
}: {
  slug: string;
  simulate?: Simulate;
  offline?: boolean;
  header?: (e: GuestEvent) => ReactNode;
  reportOpen?: boolean;
  children: (event: GuestEvent) => ReactNode;
}) {
  const { navigate } = useApp();
  const { status, event, retry } = useGuestEvent(slug, simulate);

  if (status === "loading")
    return (
      <GuestLayout slug={slug} className="items-center justify-center">
        <div
          className="flex w-full max-w-sm flex-col items-center gap-6"
          aria-busy="true"
          aria-label="Loading guestbook"
        >
          <Skeleton className="aspect-[3/4] w-44 rounded-md bg-white/60" />
          <Skeleton className="h-9 w-3/4 bg-white/60" />
          <Skeleton className="h-5 w-full bg-white/60" />
          <Skeleton className="h-13 w-full rounded-md bg-white/60" />
        </div>
      </GuestLayout>
    );

  const centered = (panel: ReactNode, e?: GuestEvent | null) => (
    <GuestLayout slug={slug} event={e} offline={offline} className="items-center justify-center">
      <div className="w-full max-w-[520px]">{panel}</div>
    </GuestLayout>
  );

  if (status === "not-found")
    return centered(
      <StatusPanel
        icon="nest"
        title="We couldn't find this guestbook"
        body="Check the link, or scan the code again."
        actions={<TextLink href="#/">Go to Finchbound</TextLink>}
      />,
    );

  if (status === "error" || !event)
    return centered(
      navigator.onLine ? (
        <StatusPanel
          icon="alert"
          title="This guestbook didn't load"
          body="It's on our side. Try again in a moment."
          actions={<Button onClick={retry}>Try again</Button>}
        />
      ) : (
        <StatusPanel
          icon="offline"
          title="You're offline"
          body="Reconnect to open this guestbook."
          actions={<Button onClick={retry}>Try again</Button>}
        />
      ),
    );

  if (event.status === "not-live")
    return centered(
      <StatusPanel
        icon="clock"
        title="This guestbook isn't open yet"
        body={`${capitalize(event.hosts)} will open it when the celebration starts.`}
        actions={
          <Button variant="secondary" onClick={retry}>
            Check again
          </Button>
        }
      />,
      event,
    );

  if (event.status === "closed")
    return centered(
      <StatusPanel
        icon="lock"
        title="This guestbook is closed"
        body={`${capitalize(event.hosts)} stopped taking new pages.`}
        actions={
          event.readerAvailable ? (
            <Button onClick={() => navigate(`/reader/${event.slug}`)}>Read the book</Button>
          ) : (
            <TextLink href="#/">Go to Finchbound</TextLink>
          )
        }
      />,
      event,
    );

  return (
    <GuestLayout
      slug={slug}
      event={event}
      offline={offline}
      header={header?.(event)}
      reportOpen={reportOpen}
    >
      {children(event)}
    </GuestLayout>
  );
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
