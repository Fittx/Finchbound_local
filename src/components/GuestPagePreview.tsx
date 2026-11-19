import { ImagePlus } from "lucide-react";
import { NotebookPage, Polaroid, bookFont } from "../book";
import type { GuestEvent } from "../api/guest";
import { cx } from "../ui";

/** Live preview of the guest's page, rendered in the event's book theme and font. */
export function GuestPagePreview({
  event,
  name,
  photo,
  message,
  className,
}: {
  event: GuestEvent;
  name: string;
  photo?: string;
  message: string;
  className?: string;
}) {
  const { theme, font } = event;
  return (
    <div
      className={cx("rounded-lg p-2 shadow-e2", className)}
      style={{ background: theme.cover }}
      role="img"
      aria-label={`Preview of your page${message ? `: ${message}` : ""}`}
    >
      <div className="aspect-[3/4] overflow-hidden rounded-sm">
        <NotebookPage look={event} feather>
          <div className="flex h-full flex-col gap-4 pt-6 pr-6 pl-16">
            <div className="w-[62%] self-center">
              {photo ? (
                <Polaroid src={photo} caption={name || undefined} look={event} />
              ) : (
                <div className="flex aspect-square w-full -rotate-2 items-center justify-center bg-white p-3 shadow-e1">
                  <span
                    className="flex size-full items-center justify-center"
                    style={{ background: theme.grid }}
                  >
                    <ImagePlus
                      className="size-8"
                      style={{ color: theme.text }}
                      aria-hidden="true"
                    />
                  </span>
                </div>
              )}
            </div>
            <p
              className="line-clamp-5"
              style={{ ...bookFont(font, 17), lineHeight: "32px", color: theme.text }}
            >
              {message || "Your message appears here."}
            </p>
            {name && (
              <p
                style={{ ...bookFont(font, 17), lineHeight: "32px", color: theme.header }}
                className="mt-auto pb-10"
              >
                — {name}
              </p>
            )}
          </div>
        </NotebookPage>
      </div>
    </div>
  );
}
