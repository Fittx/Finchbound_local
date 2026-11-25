import { LIMITS } from "../constants";
import { Input } from "../ui";

/** Parsed guest count, or undefined when the text is not a whole number in range. */
export function parseExpectedGuests(value: string): number | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  const count = Number(value.trim());
  return count >= LIMITS.expectedGuestsMin && count <= LIMITS.expectedGuestsMax ? count : undefined;
}

export function ExpectedGuestsField({
  value,
  onChange,
  showError = true,
}: {
  value: string;
  onChange: (value: string) => void;
  showError?: boolean;
}) {
  const invalid = parseExpectedGuests(value) === undefined;
  return (
    <Input
      label="Expected guests"
      type="number"
      inputMode="numeric"
      step={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      helper="About how many people will add pages. We use it so everyone can join at once, even on shared Wi-Fi."
      error={
        showError && invalid
          ? `Enter a whole number from ${LIMITS.expectedGuestsMin} to ${LIMITS.expectedGuestsMax.toLocaleString()}`
          : undefined
      }
    />
  );
}
