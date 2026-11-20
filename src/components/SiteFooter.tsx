import { Logo } from "../brand";
import { Container } from "../shell";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of service" },
  { href: "/privacy", label: "Privacy policy" },
] as const;

function LegalLinks() {
  return (
    <nav
      aria-label="Legal"
      className="flex flex-wrap justify-center gap-x-6 gap-y-2 t-caption text-muted"
    >
      {LEGAL_LINKS.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          className="flex min-h-11 items-center rounded-sm underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

/** One footer landmark, with shared links for the landing and account/legal pages. */
export function SiteFooter({ variant = "legal" }: { variant?: "full" | "legal" }) {
  return (
    <footer className={variant === "full" ? "border-t border-line" : "px-4 py-8"}>
      {variant === "full" ? (
        <Container className="grid justify-items-center gap-2 py-6 text-center md:grid-cols-[auto_1fr_auto] md:items-center md:gap-6">
          <a
            href="/"
            aria-label="Finchbound home"
            className="flex min-h-11 items-center rounded-sm md:justify-self-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate"
          >
            <Logo />
          </a>
          <LegalLinks />
          <p className="t-caption text-muted md:justify-self-end">
            © {new Date().getFullYear()} Finchbound.
          </p>
        </Container>
      ) : (
        <LegalLinks />
      )}
    </footer>
  );
}
