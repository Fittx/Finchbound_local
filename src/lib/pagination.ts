/** Split without losing whitespace, paragraphs or surrogate pairs. Measurement must be monotonic. */
export function paginateText(text: string, fits: (text: string) => boolean): string[] {
  const result: string[] = [];
  let remaining = text;
  while (remaining) {
    const chars = Array.from(remaining);
    let low = 1, high = chars.length, fit = 0;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (fits(chars.slice(0, mid).join(""))) { fit = mid; low = mid + 1; }
      else high = mid - 1;
    }
    fit = Math.max(1, fit);
    let part = chars.slice(0, fit).join("");
    const space = part.search(/\s+\S*$/u);
    if (fit < chars.length && space > part.length / 2) part = part.slice(0, space + 1);
    result.push(part);
    remaining = remaining.slice(part.length);
  }
  return result.length ? result : [""];
}
