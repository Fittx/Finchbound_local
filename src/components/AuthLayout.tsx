import type { ReactNode } from "react";
import { Logo } from "../brand";
import { Container } from "../shell";

/** Plain, texture-free shell for every host auth screen. */
export function AuthLayout({
  title,
  description,
  children,
  footer,
  hint,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-nest">
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
      <main className="flex flex-1 justify-center px-4 pt-4 pb-12 md:items-center md:px-8 md:pb-24">
        <div className="w-full max-w-[440px]">
          <div className="rounded-lg bg-linen p-6 shadow-e1 md:p-10">
            <h1 className="t-h1">{title}</h1>
            {description && <p className="mt-2 t-body">{description}</p>}
            <div className="mt-8">{children}</div>
          </div>
          {footer && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-1 t-body">
              {footer}
            </div>
          )}
          {hint && <p className="mt-2 text-center t-caption text-muted">{hint}</p>}
        </div>
      </main>
    </div>
  );
}
