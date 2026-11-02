"use client";

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Clapperboard, LayoutGrid, List, Plus, Search, SearchX, X } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { TextInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import type { VideoProject } from "@/types/video";
import { applyLibraryQuery, isFiltered, parseLibraryQuery, serializeLibraryQuery, SORT_OPTIONS, STATUS_FILTERS, statusCounts, visibleStatusFilters, type LibraryQuery, type LibraryView, type SortOrder } from "./library-query";
import { VideoCard } from "./video-card";
import { LIST_COLUMNS, VideoListItem } from "./video-list-item";

/** While any video is generating, re-read the library this often so statuses update without a reload. */
const REFRESH_MS = 5000;

/** My Videos: search, status filters, sort and grid/list view over the real video list (all client-side, no request per keystroke). */
export function VideoLibrary({ videos }: { videos: readonly VideoProject[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState<LibraryQuery>(() => parseLibraryQuery(searchParams));
  const q = useDeferredValue(query.q);

  // Keep the URL in step so the chosen view and filters survive opening a video and coming back.
  useEffect(() => {
    window.history.replaceState(null, "", `${pathname}${serializeLibraryQuery(query)}`);
  }, [pathname, query]);

  const generating = videos.some((video) => video.status === "generating");
  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [generating, router]);

  const shown = useMemo(() => applyLibraryQuery(videos, { q, status: query.status, sort: query.sort }), [videos, q, query.status, query.sort]);
  const counts = useMemo(() => statusCounts(videos, q), [videos, q]);
  const chips = visibleStatusFilters(videos, query.status);
  const update = (patch: Partial<LibraryQuery>) => setQuery((current) => ({ ...current, ...patch }));
  const clearFilters = () => update({ q: "", status: "all" });

  if (!videos.length) {
    return (
      <Card padding="none">
        <EmptyState
          icon={<Clapperboard />}
          title="No videos yet"
          description="Describe a topic and Explivio writes, narrates and renders a short vertical video for you. Your videos will appear here."
          action={
            <Link href="/create" className={buttonStyles()}>
              <Plus aria-hidden="true" className="size-5" />
              Create video
            </Link>
          }
        />
      </Card>
    );
  }

  const statusLabel = STATUS_FILTERS.find((s) => s.value === query.status)?.label ?? "";
  return (
    <section aria-labelledby="library-heading" className="flex flex-col gap-4">
      <h2 id="library-heading" className="sr-only">
        Your videos
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TextInput
          id="video-search"
          type="search"
          label="Search videos"
          hideLabel
          placeholder="Search by title or prompt"
          autoComplete="off"
          value={query.q}
          onChange={(event) => update({ q: event.target.value })}
          leadingIcon={<Search />}
          trailingAction={query.q ? <IconButton label="Clear search" icon={<X />} onClick={() => update({ q: "" })} /> : undefined}
          className="[&::-webkit-search-cancel-button]:hidden"
        />
        <div className="flex gap-3">
          <Select id="video-sort" label="Sort videos" hideLabel options={SORT_OPTIONS} value={query.sort} onChange={(event) => update({ sort: event.target.value as SortOrder })} className="sm:w-44" />
          <ViewToggle value={query.view} onChange={(view) => update({ view })} />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <StatusChip key={chip.value} label={chip.label} count={counts[chip.value]} selected={query.status === chip.value} onSelect={() => update({ status: chip.value })} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <p aria-live="polite" className="text-meta text-muted">
            {isFiltered({ ...query, q }) ? `Showing ${shown.length} of ${videos.length} ${videos.length === 1 ? "video" : "videos"}` : `${videos.length} ${videos.length === 1 ? "video" : "videos"}`}
          </p>
          {isFiltered(query) ? (
            <Button variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {shown.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<SearchX />}
            title="No videos found"
            description={
              q.trim()
                ? `Nothing matches “${q.trim()}”${query.status !== "all" ? ` among ${statusLabel.toLowerCase()} videos` : ""}. Try a shorter or different word, or search by the topic you typed when creating the video.`
                : `You have no ${statusLabel.toLowerCase()} videos right now.`
            }
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : query.view === "grid" ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-view="grid">
          {shown.map((video) => (
            <li key={video.id}>
              <VideoCard video={video} />
            </li>
          ))}
        </ul>
      ) : (
        <Card padding="none" className="overflow-hidden" data-view="list">
          <div aria-hidden="true" className={cn("hidden border-b border-border px-4 py-2.5 text-meta font-medium text-muted", LIST_COLUMNS)}>
            <span />
            <span>Video</span>
            <span>Length</span>
            <span>Created</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-border">
            {shown.map((video) => (
              <li key={video.id}>
                <VideoListItem video={video} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

function StatusChip({ label, count, selected, onSelect }: { label: string; count: number; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-meta font-medium transition-colors duration-150 sm:h-9",
        selected ? "border-primary bg-primary/15 text-[#c7bfff]" : "border-border bg-background text-muted hover:text-foreground",
      )}
    >
      {label}
      <span className={cn("rounded-full px-1.5 font-mono", selected ? "bg-primary/25" : "bg-surface-raised")}>{count}</span>
    </button>
  );
}

const VIEWS: readonly { value: LibraryView; label: string; icon: ReactNode }[] = [
  { value: "grid", label: "Grid view", icon: <LayoutGrid /> },
  { value: "list", label: "List view", icon: <List /> },
];

function ViewToggle({ value, onChange }: { value: LibraryView; onChange: (view: LibraryView) => void }) {
  return (
    <div role="group" aria-label="Layout" className="inline-flex shrink-0 rounded-control border border-border bg-background p-0.5 sm:p-1">
      {VIEWS.map((view) => (
        <button
          key={view.value}
          type="button"
          aria-pressed={value === view.value}
          aria-label={view.label}
          title={view.label}
          onClick={() => onChange(view.value)}
          className={cn(
            "inline-flex size-11 items-center sm:size-9 justify-center rounded-[8px] text-muted transition-colors duration-150 hover:text-foreground [&_svg]:size-4.5",
            value === view.value && "bg-primary/15 text-[#c7bfff] ring-1 ring-primary",
          )}
        >
          <span aria-hidden="true" className="inline-flex">
            {view.icon}
          </span>
        </button>
      ))}
    </div>
  );
}
