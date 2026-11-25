import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { initials } from "../data";
import { useOutside } from "../ui";
import { useApp } from "../store";
import { useSession } from "../api/session";
export function ProfileMenu({
  name,
  onSignOut,
  initiallyOpen = false,
}: {
  name: string;
  onSignOut: () => void;
  initiallyOpen?: boolean;
}) {
  const { navigate } = useApp();
  const session = useSession();
  const [open, setOpen] = useState(initiallyOpen);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useOutside(ref, () => setOpen(false), open);
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        className="flex min-h-11 items-center gap-2 rounded-sm px-2 hover:bg-wash"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span
          className="flex size-10 items-center justify-center rounded-full bg-gold t-caption font-bold"
          aria-hidden="true"
        >
          {initials(name)}
        </span>
        <span className="hidden text-left md:block">
          <span className="block t-caption font-medium">{name}</span>
        </span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 min-w-48 rounded-md bg-linen p-1 shadow-e3"
          onKeyDown={(e) => {
            const nodes = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=menuitem]"),
            );
            const index = nodes.indexOf(document.activeElement as HTMLButtonElement);
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              nodes[
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? nodes.length - 1
                    : (index + (e.key === "ArrowDown" ? 1 : -1) + nodes.length) % nodes.length
              ]?.focus();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
            if (e.key === "Tab") setOpen(false);
          }}
        >
          <button
            role="menuitem"
            className="flex min-h-11 w-full items-center rounded-sm px-3 text-left hover:bg-wash"
            onClick={() => {
              close();
              navigate("/account");
            }}
          >
            Account
          </button>
          {session?.role === "admin" && (
            <button
              role="menuitem"
              className="flex min-h-11 w-full items-center rounded-sm px-3 text-left hover:bg-wash"
              onClick={() => {
                close();
                navigate("/admin");
              }}
            >
              Admin reports
            </button>
          )}
          <button
            role="menuitem"
            className="flex min-h-11 w-full items-center rounded-sm px-3 text-left hover:bg-wash"
            onClick={() => {
              close();
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
