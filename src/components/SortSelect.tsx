import { Select } from "../ui";
import type { PageSort } from "../api/pages";
export function SortSelect({
  value,
  onChange,
}: {
  value: PageSort;
  onChange: (v: PageSort) => void;
}) {
  return (
    <Select
      label="Sort pages"
      value={value}
      onChange={onChange}
      options={[
        { value: "position", label: "Position" },
        { value: "edited", label: "Recently edited" },
      ]}
    />
  );
}
