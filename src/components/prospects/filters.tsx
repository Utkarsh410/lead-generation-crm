"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LEAD_STATUSES, PROSPECT_TYPES } from "@/lib/domain/constants";
import { useWorkspace } from "@/components/workspace/workspace-context";

export function ProspectFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const { sources } = useWorkspace();
  const [more, setMore] = useState(Boolean(params.get("industry") || params.get("location") || params.get("min_score") || params.get("from") || params.get("to")));

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  // debounce search input
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q.trim() === current) return;
    const t = setTimeout(() => update("q", q.trim() || null), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = ["q", "stage", "type", "source", "temp", "archived", "demo", "industry", "location", "min_score", "from", "to"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1 sm:max-w-xs">
        <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search business, contact, email…"
          className="pl-8"
          aria-label="Search prospects"
        />
      </div>
      <NativeSelect className="w-auto" value={params.get("stage") ?? ""} onChange={(e) => update("stage", e.target.value)} aria-label="Lead status">
        <option value="">All statuses</option>
        {LEAD_STATUSES.list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect className="w-auto" value={params.get("type") ?? ""} onChange={(e) => update("type", e.target.value)} aria-label="Prospect type">
        <option value="">All types</option>
        {PROSPECT_TYPES.list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect className="w-auto" value={params.get("source") ?? ""} onChange={(e) => update("source", e.target.value)} aria-label="Source">
        <option value="">All sources</option>
        {sources.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect className="w-auto" value={params.get("temp") ?? ""} onChange={(e) => update("temp", e.target.value)} aria-label="Priority">
        <option value="">Any priority</option>
        <option value="hot">Hot</option>
        <option value="warm">Warm</option>
        <option value="cold">Cold</option>
      </NativeSelect>
      <NativeSelect className="w-auto" value={params.get("archived") ?? ""} onChange={(e) => update("archived", e.target.value)} aria-label="Archived">
        <option value="">Active</option>
        <option value="only">Archived</option>
        <option value="include">Active + archived</option>
      </NativeSelect>
      <Button variant="ghost" size="sm" onClick={() => setMore(!more)} aria-expanded={more}>
        {more ? "Fewer filters" : "More filters"}
      </Button>
      {more ? (
        <div className="flex w-full flex-wrap items-center gap-2">
          <Input
            className="w-40"
            placeholder="Industry"
            defaultValue={params.get("industry") ?? ""}
            onBlur={(e) => update("industry", e.target.value.trim() || null)}
            aria-label="Industry contains"
          />
          <Input
            className="w-40"
            placeholder="Location"
            defaultValue={params.get("location") ?? ""}
            onBlur={(e) => update("location", e.target.value.trim() || null)}
            aria-label="Location contains"
          />
          <NativeSelect className="w-auto" value={params.get("min_score") ?? ""} onChange={(e) => update("min_score", e.target.value)} aria-label="Minimum lead score">
            <option value="">Any lead score</option>
            <option value="40">Score 40+</option>
            <option value="60">Score 60+</option>
            <option value="70">Score 70+</option>
            <option value="85">Score 85+</option>
          </NativeSelect>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            Added from
            <Input type="date" className="w-36" value={params.get("from") ?? ""} onChange={(e) => update("from", e.target.value || null)} />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            to
            <Input type="date" className="w-36" value={params.get("to") ?? ""} onChange={(e) => update("to", e.target.value || null)} />
          </label>
        </div>
      ) : null}
      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.replace(pathname);
          }}
        >
          <X /> Clear
        </Button>
      ) : null}
    </div>
  );
}
