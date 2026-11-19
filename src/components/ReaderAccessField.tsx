import { READER_ACCESS_OPTIONS } from "../constants";
import type { Visibility } from "../types/books";
import { RadioGroup } from "../ui";

/** Who can open a published personal book. Used by the wizard and book settings. */
export function ReaderAccessField({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  return (
    <RadioGroup<Visibility>
      label="Reader access"
      value={value}
      onChange={onChange}
      options={READER_ACCESS_OPTIONS}
    />
  );
}
