import { useSession } from "../api/session";
import { SiteFooter } from "../components/SiteFooter";
import { useEffect, useState } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import { IconConnect, IconCurate, IconFlock, Logo } from "../brand";
import { Scaled, Spread, useFlip } from "../book";
import { PRESETS } from "../data";
import { Container } from "../shell";
import { useApp } from "../store";
import { Button, ErrorState, Skeleton } from "../ui";

const FEATURES = [
  {
    icon: IconConnect,
    title: "Connect",
    body: "Guests scan your QR code and land straight on your book.",
  },
  {
    icon: IconFlock,
    title: "Flock submissions",
    body: "Photos and messages arrive from every phone in the room.",
  },
  {
    icon: IconCurate,
    title: "Curate",
    body: "Drag pages into order and watch the flipbook update live.",
  },
];

export function Landing() {
  const { navigate } = useApp();
  const session = useSession();
  return (
    <div className="min-h-dvh bg-nest">
      <header>
        <Container className="flex h-16 items-center justify-between gap-2 md:h-20">
          <a
            href="/"
            className="-ml-1 flex min-h-11 items-center rounded-sm px-1"
            aria-label="Finchbound home"
          >
            <Logo />
          </a>
          <nav className="flex items-center gap-0 md:gap-3">
            {session ? (
              <Button className="max-md:px-3" onClick={() => navigate("/dashboard")}>
                Your books
              </Button>
            ) : (
              <>
                <Button variant="link" className="px-2 md:px-3" onClick={() => navigate("/signin")}>
                  Sign in
                </Button>
                <Button className="max-md:px-3" onClick={() => navigate("/signup")}>
                  Get started
                </Button>
              </>
            )}
          </nav>
        </Container>
      </header>

      <main>
        <Container className="grid items-center gap-10 pt-8 pb-16 md:gap-12 md:pt-12 md:pb-24 lg:grid-cols-12 lg:gap-6 lg:pt-20 lg:pb-32">
          <div className="flex flex-col gap-6 lg:col-span-5 lg:pr-6">
            <h1 className="t-display max-w-[640px]">
              Finchbound: Feather your memories into timeless guestbooks
            </h1>
            <p className="max-w-[520px] t-body md:text-lg md:leading-7">
              Guests scan a QR code and add photos and notes, and you shape them into a flipbook
              worth keeping.
            </p>
            <div className="flex flex-col gap-3 pt-2 md:flex-row">
              <Button size="lg" onClick={() => navigate(session ? "/dashboard" : "/signup")}>
                {session ? "Go to your books" : "Get started"}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                iconRight={<ArrowRight className="size-5" aria-hidden="true" />}
                onClick={() => navigate("/create")}
              >
                {session ? "Create a book" : "Nest your first book"}
              </Button>
            </div>
          </div>
          <div className="lg:col-span-7">
            <HeroPreview />
          </div>
        </Container>

        <section aria-labelledby="features" className="pb-20 md:pb-28">
          <Container>
            <h2 id="features" className="t-h1 mb-8 md:mb-12">
              Everything a guestbook needs
            </h2>
            <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li
                  key={title}
                  className="flex flex-col gap-4 rounded-lg bg-linen p-6 shadow-e1 lg:p-8"
                >
                  <span className="flex size-16 items-center justify-center rounded-md bg-wash">
                    <Icon className="size-10" />
                  </span>
                  <h3 className="t-h2">{title}</h3>
                  <p className="t-body">{body}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      </main>

      <SiteFooter variant="full" />
    </div>
  );
}

const SAMPLE = { theme: PRESETS.crimson.colors, font: "hand" as const, lines: true };
const EMPTY_PAGES = [
  {
    id: "e1",
    title: "Your story starts here",
    body: "Guests fill these pages with photos and notes the moment they scan your code.",
  },
];

/** Notebook that turns a page every few seconds. Pausable (WCAG 2.2.2). */
function HeroPreview() {
  const { screenState, setScreenState, reduced } = useApp();
  const pages = EMPTY_PAGES;
  const { index, setIndex, turn, go } = useFlip(pages.length, reduced);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || pages.length < 2) return;
    const t = window.setInterval(() => {
      if (index >= pages.length - 1) setIndex(0);
      else go("next");
    }, 3400);
    return () => window.clearInterval(t);
  });

  if (screenState === "loading")
    return (
      <div aria-busy="true" aria-label="Loading preview">
        <Skeleton className="aspect-[920/600] w-full rounded-lg" />
      </div>
    );
  if (screenState === "error")
    return (
      <div className="flex aspect-[920/600] w-full items-center justify-center rounded-lg bg-wash">
        <ErrorState
          title="The preview didn't load"
          body="Your connection may be slow. The rest of the page still works."
          onRetry={() => setScreenState("default")}
        />
      </div>
    );

  return (
    <figure className="relative">
      <Scaled w={920} h={600}>
        <Spread look={SAMPLE} pages={pages} index={index} turn={turn} reduced={reduced} />
      </Scaled>
      <figcaption className="mt-4 flex items-center justify-between gap-4">
        <span className="t-caption text-muted">Your photos and messages, gathered in a book</span>
        {pages.length > 1 && (
          <Button
            variant="ghost"
            className="px-3"
            onClick={() => setPlaying((p) => !p)}
            icon={
              playing ? (
                <Pause className="size-4" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )
            }
          >
            <span className="t-caption font-medium">
              {playing ? "Pause preview" : "Play preview"}
            </span>
          </Button>
        )}
      </figcaption>
    </figure>
  );
}
