import { ListChecks, Search, X } from "lucide-react";
import { Checkbox } from "../../components/Checkbox";
import { FilterTabs } from "../../components/FilterTabs";
import {
  FEED_FILTERS,
  MODERATION_ACTIONS,
  SEARCH_GUESTS_PLACEHOLDER,
  WITH_PHOTO_LABEL,
} from "../../constants";
import type { FeedFilter } from "../../types/submissions";
import { Button, Input } from "../../ui";
import type { Moderation } from "./useModeration";

export function ModerationToolbar({ mod }: { mod: Moderation }) {
  const loading = mod.status === "loading";
  const error = mod.status === "error";
  return (
    <div className="flex flex-col gap-3">
      <FilterTabs<FeedFilter>
        label="Filter entries"
        tabs={FEED_FILTERS.map((f) => ({ ...f, count: mod.counts[f.key] }))}
        value={mod.filter}
        onChange={mod.setFilter}
        loading={loading}
        error={error}
      />
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <div className="md:w-72">
          <Input
            label={SEARCH_GUESTS_PLACEHOLDER}
            hideLabel
            type="search"
            placeholder={SEARCH_GUESTS_PLACEHOLDER}
            value={mod.query}
            disabled={error}
            onChange={(e) => mod.setQuery(e.target.value)}
            leading={<Search className="size-5" aria-hidden="true" />}
            trailing={
              mod.query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => mod.setQuery("")}
                  className="-mr-2 flex size-11 items-center justify-center rounded-sm hover:bg-wash"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )
            }
          />
        </div>
        <div className="flex items-center justify-between gap-3 md:flex-1">
          <div className="pl-2">
            <Checkbox
              label={WITH_PHOTO_LABEL}
              checked={mod.withPhoto}
              onChange={mod.setWithPhoto}
              disabled={loading || error}
            />
          </div>
          <Button
            variant="ghost"
            className="px-3"
            icon={<ListChecks className="size-5" aria-hidden="true" />}
            aria-pressed={mod.selectMode}
            disabled={loading || error || !mod.filtered.length}
            onClick={mod.toggleSelectMode}
          >
            {mod.selectMode ? MODERATION_ACTIONS.doneSelecting : MODERATION_ACTIONS.select}
          </Button>
        </div>
      </div>
    </div>
  );
}
