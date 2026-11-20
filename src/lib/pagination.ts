/** Largest fitting prefix, preferring nearby sentence ends, then complete words. */
export function takePage(text: string, fits: (text: string) => boolean): string {
  const chars = Array.from(text);
  let low = 1, high = chars.length, fit = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (fits(chars.slice(0, mid).join(""))) { fit = mid; low = mid + 1; }
    else high = mid - 1;
  }
  if (!fit && text) throw new Error("The page has no room for a character.");
  let part = chars.slice(0, fit).join("");
  if (fit === chars.length) return part;
  const sentences = [...part.matchAll(/[.!?]["'’”)]*\s+/gu)];
  const sentence = sentences.at(-1);
  const end = sentence ? sentence.index! + sentence[0].length : 0;
  // Never sacrifice a large portion of a page just to finish a sentence.
  if (end >= part.length * 0.9) return part.slice(0, end);
  // If the next character is whitespace, this prefix already ends on a word boundary.
  if (/\s/u.test(text.slice(part.length, part.length + 1))) return part;
  const space = part.search(/\s+\S*$/u);
  if (space > 0) part = part.slice(0, space + 1);
  return part;
}
export function paginateText(text: string, fits: (text: string) => boolean): string[] {
  const result: string[] = [];
  let remaining = text;
  while (remaining) {
    const part = takePage(remaining, fits);
    result.push(part); remaining = remaining.slice(part.length);
  }
  return result.length ? result : [""];
}
