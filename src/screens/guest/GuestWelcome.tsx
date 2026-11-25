import { BookCover } from "../../book";
import { useOnline } from "../../hooks/useOnline";
import { useApp } from "../../store";
import { Button, Dot } from "../../ui";
import { GuestGate } from "./GuestGate";
import { requirements } from "./summary";

const EVENT_VARIANTS = ["loading", "not-live", "closed", "server-error"];

export function GuestWelcome() {
  const { route, navigate } = useApp();
  const slug = route.path[0]!;
  const variant = route.query.get("variant");
  const online = useOnline(variant === "offline");
  return (
    <GuestGate
      slug={slug}
      simulate={variant && EVENT_VARIANTS.includes(variant) ? variant : undefined}
      offline={!online}
      reportOpen={variant === "report"}
    >
      {(event) => (
        <div className="grid flex-1 content-center items-center gap-8 lg:grid-cols-12 lg:gap-6">
          <div className="flex justify-center lg:col-span-6">
            <BookCover look={event} title={event.title} className="w-44 md:w-56 lg:w-80" />
          </div>
          <div className="flex flex-col items-center gap-6 text-center lg:col-span-6 lg:items-start lg:text-left">
            <div className="flex max-w-md flex-col gap-3">
              <p className="t-caption font-medium tracking-wide text-muted uppercase">
                {event.title}
              </p>
              <h1 className="t-h1">Leave a page for {event.hosts}</h1>
              <p className="t-body md:text-lg md:leading-7">{event.prompt}</p>
              <p className="flex items-center justify-center gap-2 t-caption lg:justify-start">
                <Dot color={event.theme.accent} />
                {requirements(event)}
              </p>
            </div>
            <Button
              size="lg"
              className="w-full max-w-md md:w-auto"
              onClick={() => navigate(`/${slug}/join/form`)}
            >
              Add your page
            </Button>
            {event.access === "strict" && (
              <p className="max-w-md t-caption">
                The hosts approve each page before it appears in the book.
              </p>
            )}
          </div>
        </div>
      )}
    </GuestGate>
  );
}
