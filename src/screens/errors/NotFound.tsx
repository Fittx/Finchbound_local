import { StatusPanel } from "../../components/StatusPanel";
import { TextLink } from "../../components/TextLink";
import { Logo } from "../../brand";
import { Container } from "../../shell";
import { useApp } from "../../store";
import { Button } from "../../ui";
import { useErrorTheme } from "./useErrorTheme";

export function NotFound() {
  const { navigate } = useApp();
  const { book, style } = useErrorTheme();
  return (
    <div className="flex min-h-dvh flex-col bg-nest" style={style}>
      <header>
        <Container className="flex h-16 items-center md:h-20">
          <a
            href="/"
            className="-ml-1 flex min-h-11 items-center rounded-sm px-1"
            aria-label="Finchbound home"
          >
            <Logo />
          </a>
        </Container>
      </header>
      <main className="flex flex-1 justify-center px-4 pt-4 pb-16 md:items-center">
        <div className="flex w-full max-w-[520px] flex-col items-center gap-4">
          {book && <p className="t-body font-medium">{book.title}</p>}
          <StatusPanel
            icon="nest"
            className="w-full max-w-[520px]"
            title="We couldn't find that page"
            body="The link may be broken, or the page has moved."
            actions={
              <>
                <Button
                  size="lg"
                  onClick={() => navigate("/dashboard")}
                  className="w-full sm:w-auto"
                >
                  Go to your books
                </Button>
                {book && <TextLink href={`/reader/${book.slug}`}>Back to the book</TextLink>}
                <TextLink href="/">Go to the homepage</TextLink>
              </>
            }
          />
        </div>
      </main>
    </div>
  );
}
