type SvgProps = { className?: string; title?: string };

/** Finch in flight above an open journal. */
export function LogoMark({ className = "size-8", title }: SvgProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <path
        d="M5.5 13.2 9.6 12c2-1.4 5-2 8-1.9 1.4-1.4 3.4-1.8 5-.9l2.8.6-2.4 1.1c-.6 2.2-3 3.8-6.4 4-3.4.2-6.4-.5-11.1-1.7Z"
        fill="#E63946"
      />
      <path d="M12.4 11c.2-3.4 1.6-6.4 5.4-8.4-.4 3-.6 5.6-.4 8Z" fill="#E63946" />
      <path d="M3 20.5c4-1.5 8.5-1.3 13 1V28c-4.5-2.2-9-2.4-13-1Z" fill="#2B2D42" />
      <path d="M29 20.5c-4-1.5-8.5-1.3-13 1V28c4.5-2.2 9-2.4 13-1Z" fill="#2B2D42" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className="size-8" />
      <span
        className={`t-body font-bold ${compact ? "sr-only md:not-sr-only" : ""}`}
        style={{ fontSize: 19 }}
      >
        Finchbound
      </span>
    </span>
  );
}

/** The single recurring motif: notebook corner mark and page indicator. */
export function FeatherMark({
  className = "size-5",
  color = "currentColor",
}: SvgProps & { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M19.8 3.2c-6.6.3-12 5.7-12.4 12.2l1.2 1.2c6.4-.4 11.8-5.8 12.1-12.3Z" fill={color} />
      <path d="M3.8 20.2 15.8 8.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyNest({ className = "w-48" }: SvgProps) {
  return (
    <svg viewBox="0 0 200 150" className={className} aria-hidden="true">
      <g transform="translate(118 30) rotate(28)">
        <path d="M30 2C17 3 6 14 5 27l2.4 2.4C20.3 28.6 31.2 17.8 31.6 4.6Z" fill="#E63946" />
        <path d="M1 33 25 9" stroke="#E63946" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <path d="M28 80c4 38 42 52 72 52s68-14 72-52Z" fill="#E8D8BE" />
      <ellipse cx="100" cy="80" rx="72" ry="16" fill="#D9C4A3" />
      <ellipse cx="100" cy="80" rx="58" ry="10" fill="#C4A77E" />
      <g stroke="#A88A63" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M38 94c30 12 84 14 124-2" />
        <path d="M48 110c32 10 74 10 104-4" />
        <path d="M62 124c22 6 54 6 76-2" />
        <path d="M22 74l26 10M178 72l-26 12M34 100l20-4M168 98l-22-4" />
      </g>
    </svg>
  );
}

export function IconConnect({ className = "size-12" }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none">
      <g stroke="#2B2D42" strokeWidth="2.4" strokeLinejoin="round">
        <rect x="7" y="7" width="12" height="12" rx="2.5" />
        <rect x="29" y="7" width="12" height="12" rx="2.5" />
        <rect x="7" y="29" width="12" height="12" rx="2.5" />
      </g>
      <g fill="#E63946">
        <rect x="29" y="29" width="5" height="5" rx="1" />
        <rect x="36" y="36" width="5" height="5" rx="1" />
        <rect x="36" y="29" width="5" height="5" rx="1" opacity="0" />
        <rect x="29" y="36" width="5" height="5" rx="1" opacity="0" />
      </g>
      <rect x="11" y="11" width="4" height="4" rx="1" fill="#2B2D42" />
      <rect x="33" y="11" width="4" height="4" rx="1" fill="#2B2D42" />
      <rect x="11" y="33" width="4" height="4" rx="1" fill="#2B2D42" />
    </svg>
  );
}

export function IconFlock({ className = "size-12" }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none">
      <rect x="6" y="12" width="28" height="26" rx="3" stroke="#2B2D42" strokeWidth="2.4" />
      <path d="m6 32 8-8 7 7 4-4 9 9" stroke="#2B2D42" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="26" cy="20" r="2.6" fill="#2B2D42" />
      <path
        d="M40 30V10m-6 6 6-6 6 6"
        stroke="#E63946"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCurate({ className = "size-12" }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none">
      <rect x="6" y="6" width="15" height="15" rx="3" stroke="#2B2D42" strokeWidth="2.4" />
      <rect x="6" y="27" width="15" height="15" rx="3" stroke="#2B2D42" strokeWidth="2.4" />
      <rect x="27" y="27" width="15" height="15" rx="3" stroke="#2B2D42" strokeWidth="2.4" />
      <rect x="29" y="4" width="15" height="15" rx="3" fill="#E63946" transform="rotate(8 36 11)" />
    </svg>
  );
}
