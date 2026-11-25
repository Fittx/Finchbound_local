import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { request } from "../api/client";
import { Button, Input, Modal, Textarea } from "../ui";
import { FormAlert } from "./FormAlert";
type Entry = { id: string; name: string; message: string; createdAt: string };
export function BookFeedback({
  slug,
  bookId,
  compact = false,
}: {
  slug?: string;
  bookId?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState("idle");
  const [items, setItems] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function load(more = false) {
    setState("loading");
    setError("");
    try {
      const data = await request<{ items: Entry[]; nextCursor: string | null }>(
        `/books/${bookId}/feedback${more && cursor ? `?cursor=${cursor}` : ""}`,
      );
      setItems((old) => (more ? [...old, ...data.items] : data.items));
      setCursor(data.nextCursor);
      setState("idle");
    } catch {
      setError("Couldn't load feedback. Try again.");
      setState("idle");
    }
  }
  useEffect(() => {
    if (open && bookId) void load();
  }, [open, bookId]);
  async function send() {
    setState("sending");
    setError("");
    try {
      await request(`/public/books/${encodeURIComponent(slug!)}/feedback`, "POST", {
        name,
        message,
      });
      setState("sent");
      setMessage("");
    } catch {
      setError("Couldn't send your message. Please wait a moment and try again.");
      setState("idle");
    }
  }
  return (
    <>
      <Button
        variant="secondary"
        size={bookId ? "md" : "icon"}
        className={bookId && compact ? "max-lg:w-11 max-lg:px-0" : undefined}
        icon={bookId ? <MessageSquare className="size-5" aria-hidden="true" /> : undefined}
        aria-label={bookId ? "Reader feedback" : "Message the book owner"}
        onClick={() => {
          setOpen(true);
          setState("idle");
          setError("");
        }}
      >
        {bookId ? (
          <span className={compact ? "hidden lg:inline" : undefined}>Reader feedback</span>
        ) : (
          <MessageSquare className="size-5" aria-hidden="true" />
        )}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        dismissible={state !== "sending"}
        title={bookId ? "Reader feedback" : "Message the book owner"}
        footer={
          !bookId && state !== "sent" ? (
            <Button disabled={!message.trim()} loading={state === "sending"} onClick={send}>
              Send message
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          {error && <FormAlert>{error}</FormAlert>}
          {bookId ? (
            <>
              {state === "loading" && <p role="status">Loading feedback</p>}
              {error && <Button onClick={() => load()}>Retry</Button>}
              {!items.length && state !== "loading" && !error && <p>No feedback yet.</p>}
              {items.map((item) => (
                <article key={item.id} className="border-b border-line pb-4">
                  <p className="font-medium">{item.name || "Anonymous reader"}</p>
                  <p className="whitespace-pre-wrap break-words">{item.message}</p>
                  <p className="t-caption text-muted">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </article>
              ))}
              {cursor && (
                <Button disabled={state === "loading"} onClick={() => load(true)}>
                  Load more
                </Button>
              )}
            </>
          ) : state === "sent" ? (
            <p role="status">Your message was sent privately to the book owner.</p>
          ) : (
            <>
              <p>This message is private and will not appear in the book.</p>
              <Input
                label="Name (optional)"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
              />
              <Textarea
                label="Message"
                value={message}
                max={1000}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message"
              />
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
